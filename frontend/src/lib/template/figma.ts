/**
 * @file figma.ts
 * @summary Figma REST API integration and document tree converter for CertiChain Template Studio.
 */

import { TemplateSpec, TemplateBlock, TemplateField, Rect, TextStyle, FieldMapTarget } from './types';
import { mapToWhitelistedFont, ensureFontLoaded } from './fonts';
import { inpaintRegionsAsync } from './inpaint';
import { getImagePixelData, pixelDataToDataUrl } from './image';

export interface FigmaParsedUrl {
  fileKey: string;
  nodeId?: string;
}

export interface FigmaFrameSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnailUrl?: string;
}

const LOCAL_STORAGE_FIGMA_TOKEN_KEY = 'certichain_figma_pat';

export function getSavedFigmaToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(LOCAL_STORAGE_FIGMA_TOKEN_KEY) || '';
}

export function saveFigmaToken(token: string): void {
  if (typeof window === 'undefined') return;
  if (token.trim()) {
    localStorage.setItem(LOCAL_STORAGE_FIGMA_TOKEN_KEY, token.trim());
  } else {
    localStorage.removeItem(LOCAL_STORAGE_FIGMA_TOKEN_KEY);
  }
}

/**
 * Parses Figma URL into fileKey and optional nodeId.
 * Supports design URLs, file URLs, and board URLs.
 * Example: https://www.figma.com/design/AbCdEf12345/Certificate-Template?node-id=12-34
 */
export function parseFigmaUrl(rawUrl: string): FigmaParsedUrl | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const clean = rawUrl.trim();
  const regex = /figma\.com\/(?:design|file|board)\/([a-zA-Z0-9_-]+)(?:\/[^?#]*)?(?:\?[^#]*node-id=([a-zA-Z0-9%:-]+))?/;
  const match = clean.match(regex);

  if (!match || !match[1]) return null;

  const fileKey = match[1];
  let nodeId: string | undefined = undefined;

  if (match[2]) {
    // Decode and standardize node ID (Figma URLs often use '12-34' which maps to '12:34' in API)
    const decoded = decodeURIComponent(match[2]);
    nodeId = decoded.replace(/-/g, ':');
  }

  return { fileKey, nodeId };
}

/**
 * Normalizes Figma RGB color (0..1) to #RRGGBB hex string.
 */
export function figmaColorToHex(color?: { r: number; g: number; b: number }): string {
  if (!color) return '#1E293B';
  const r = Math.round(Math.min(1, Math.max(0, color.r)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, color.g)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, color.b)) * 255);
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
      .toUpperCase()
  );
}

/**
 * Maps Figma font weight string or number to valid TextStyle weights.
 */
export function mapFigmaFontWeight(weight: any): 300 | 400 | 500 | 600 | 700 | 800 {
  const num = typeof weight === 'number' ? weight : parseInt(String(weight), 10);
  if (!isNaN(num)) {
    if (num <= 300) return 300;
    if (num <= 400) return 400;
    if (num <= 500) return 500;
    if (num <= 600) return 600;
    if (num <= 700) return 700;
    return 800;
  }

  const str = String(weight).toLowerCase();
  if (str.includes('semi') || str.includes('medium')) return 600;
  if (str.includes('bold') || str.includes('heavy') || str.includes('black')) return 700;
  if (str.includes('light') || str.includes('thin') || str.includes('extra light')) return 300;
  return 400;
}

/**
 * Helper to call Figma API with token, using direct fetch with fallback proxy.
 */
async function callFigmaApi(endpoint: string, token: string): Promise<any> {
  const headers = {
    'X-Figma-Token': token.trim(),
    'Content-Type': 'application/json',
  };

  try {
    const directRes = await fetch(endpoint, { headers });
    if (directRes.ok) {
      return await directRes.json();
    }
    if (directRes.status === 403) {
      throw new Error('Figma API 403: Invalid Figma Personal Access Token or access denied.');
    }
    if (directRes.status === 404) {
      throw new Error('Figma API 404: File or Node ID not found.');
    }
  } catch (directErr: any) {
    // If direct failed with CORS or network error, attempt proxy
    if (directErr.message?.includes('403') || directErr.message?.includes('404')) {
      throw directErr;
    }
  }

  // Fallback to proxy
  const proxyUrl = `/api/figmaProxy?url=${encodeURIComponent(endpoint)}`;
  const proxyRes = await fetch(proxyUrl, {
    headers: {
      'x-figma-token': token.trim(),
    },
  });

  if (!proxyRes.ok) {
    const text = await proxyRes.text().catch(() => '');
    throw new Error(`Figma request failed (${proxyRes.status}): ${text || proxyRes.statusText}`);
  }

  return await proxyRes.json();
}

/**
 * Fetches file metadata and lists top-level frames/canvases.
 */
export async function listFigmaFrames(fileKey: string, token: string): Promise<FigmaFrameSummary[]> {
  const data = await callFigmaApi(`https://api.figma.com/v1/files/${fileKey}?depth=2`, token);
  const frames: FigmaFrameSummary[] = [];

  const document = data.document;
  if (!document || !document.children) return frames;

  for (const page of document.children) {
    if (page.type === 'CANVAS' && page.children) {
      for (const node of page.children) {
        if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'SECTION') {
          const bbox = node.absoluteBoundingBox;
          if (bbox && bbox.width > 200 && bbox.height > 200) {
            frames.push({
              id: node.id,
              name: `${page.name} / ${node.name}`,
              width: Math.round(bbox.width),
              height: Math.round(bbox.height),
            });
          }
        }
      }
    }
  }

  return frames;
}

/**
 * Fetches rendered PNG image of a Figma frame as a Data URL.
 */
export async function fetchFigmaFrameImage(
  fileKey: string,
  nodeId: string,
  token: string,
  scale: number = 2
): Promise<string> {
  const data = await callFigmaApi(
    `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`,
    token
  );

  const imageUrl = data.images?.[nodeId];
  if (!imageUrl) {
    throw new Error(`No image rendered by Figma for node ID ${nodeId}`);
  }

  // Fetch the image binary and convert to Data URL
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to download rendered Figma frame image: ${imgRes.statusText}`);
  }

  const blob = await imgRes.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface ExtractedFigmaText {
  nodeId: string;
  name: string;
  text: string;
  rect: Rect;
  style: TextStyle;
  isVariable: boolean;
  tokens: string[];
}

/**
 * Recursively extracts text and QR layout elements from Figma frame tree.
 */
function extractFigmaNodes(
  node: any,
  frameBbox: { x: number; y: number; width: number; height: number },
  scaleFactor: number
): {
  texts: ExtractedFigmaText[];
  qrPlacement?: Rect;
} {
  const texts: ExtractedFigmaText[] = [];
  let qrPlacement: Rect | undefined = undefined;

  function traverse(n: any) {
    if (!n || n.visible === false) return;

    const bbox = n.absoluteBoundingBox;
    if (!bbox) return;

    const relX = Math.round((bbox.x - frameBbox.x) * scaleFactor);
    const relY = Math.round((bbox.y - frameBbox.y) * scaleFactor);
    const relW = Math.round(bbox.width * scaleFactor);
    const relH = Math.round(bbox.height * scaleFactor);

    // Check for QR code placement marker (named qr, qrcode, qr_code, or qr_placement)
    const lowerName = (n.name || '').toLowerCase();
    if (
      (lowerName.includes('qr') || lowerName.includes('qrcode') || lowerName.includes('barcode')) &&
      n.type !== 'TEXT'
    ) {
      qrPlacement = { x: relX, y: relY, w: relW, h: relH };
    }

    // Process Text layers
    if (n.type === 'TEXT' && n.characters && n.characters.trim()) {
      const fStyle = n.style || {};
      const solidFill = Array.isArray(n.fills)
        ? n.fills.find((f: any) => f.type === 'SOLID' && f.visible !== false)
        : null;

      const rawFontFamily = fStyle.fontFamily || 'Plus Jakarta Sans';
      const whitelistedFont = mapToWhitelistedFont(rawFontFamily);
      ensureFontLoaded(whitelistedFont);

      const colorHex = figmaColorToHex(solidFill?.color);
      const fontWeight = mapFigmaFontWeight(fStyle.fontWeight);
      const fontSize = Math.max(12, Math.round((fStyle.fontSize || 24) * scaleFactor));
      
      let align: 'left' | 'center' | 'right' | 'justify' = 'left';
      if (fStyle.textAlignHorizontal === 'CENTER') align = 'center';
      else if (fStyle.textAlignHorizontal === 'RIGHT') align = 'right';
      else if (fStyle.textAlignHorizontal === 'JUSTIFIED') align = 'justify';

      const lineHeight =
        fStyle.lineHeightPx && fStyle.fontSize
          ? Math.max(1.0, Math.min(2.0, fStyle.lineHeightPx / fStyle.fontSize))
          : 1.3;

      const textVal = n.characters.trim();
      const tokenMatches = textVal.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
      const isTokenized = tokenMatches.length > 0;

      // Check if layer name or text suggests variable role
      const isNamedVar =
        /^(recipient|name|student|date|issue_date|course|title|cert|number|id|grade|score)/i.test(
          lowerName
        ) ||
        lowerName.startsWith('var_') ||
        lowerName.startsWith('{{');

      texts.push({
        nodeId: n.id,
        name: n.name,
        text: textVal,
        rect: {
          x: Math.max(0, relX),
          y: Math.max(0, relY),
          w: Math.max(20, relW),
          h: Math.max(14, relH),
        },
        style: {
          fontFamily: whitelistedFont,
          fontWeight,
          fontSize,
          color: colorHex,
          align,
          lineHeight: Number(lineHeight.toFixed(2)),
          letterSpacing: Math.round((fStyle.letterSpacing || 0) * scaleFactor),
          transform: 'none',
          fit: 'shrink',
          maxLines: 4,
        },
        isVariable: isTokenized || isNamedVar,
        tokens: tokenMatches.map((t: string) => t.replace(/[{}]/g, '')),
      });
    }

    if (n.children && Array.isArray(n.children)) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return { texts, qrPlacement };
}

/**
 * Main function: Imports a Figma Frame and builds a complete, high-fidelity TemplateSpec.
 */
export async function importFigmaTemplate(
  fileKey: string,
  nodeId: string | undefined,
  token: string,
  onProgress?: (step: string, pct: number) => void,
  existingOcrSpec?: Partial<TemplateSpec> | null
): Promise<TemplateSpec> {
  onProgress?.('Contacting Figma Cloud API...', 15);

  let targetNodeId = nodeId;

  // If no node ID provided in URL, list frames and select the first top-level frame
  if (!targetNodeId) {
    onProgress?.('Analyzing Figma document structure...', 25);
    const frames = await listFigmaFrames(fileKey, token);
    if (frames.length === 0) {
      throw new Error('No valid frames or certificate artboards found in this Figma file.');
    }
    targetNodeId = frames[0].id;
  }

  onProgress?.('Fetching node tree and typography hierarchy...', 40);
  const nodesRes = await callFigmaApi(
    `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(targetNodeId)}`,
    token
  );

  const nodeWrapper = nodesRes.nodes?.[targetNodeId];
  if (!nodeWrapper || !nodeWrapper.document) {
    throw new Error(`Frame node ${targetNodeId} not found in Figma file.`);
  }

  const frameDoc = nodeWrapper.document;
  const frameBbox = frameDoc.absoluteBoundingBox || { x: 0, y: 0, width: 1920, height: 1080 };
  const frameWidth = Math.round(frameBbox.width);
  const frameHeight = Math.round(frameBbox.height);

  // High-res target resolution (minimum 1920 width for crisp PDF/PNG export)
  const targetWidth = Math.max(1920, frameWidth);
  const scaleFactor = targetWidth / frameWidth;
  const targetHeight = Math.round(frameHeight * scaleFactor);

  onProgress?.('Rendering high-resolution 2x frame background...', 60);
  const backgroundDataUrl = await fetchFigmaFrameImage(fileKey, targetNodeId, token, 2);

  onProgress?.('Extracting text layers, typography, and variable mappings...', 75);
  const { texts, qrPlacement } = extractFigmaNodes(frameDoc, frameBbox, scaleFactor);

  const blocks: TemplateBlock[] = [];
  const fields: TemplateField[] = [];
  const registeredFieldKeys = new Set<string>();

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    let templateText = t.text;
    let role: 'variable' | 'paragraph' | 'fixed' = t.isVariable ? 'variable' : 'fixed';

    if (t.tokens.length > 0) {
      // Already has {{tokens}} inside text
      role = t.tokens.length > 1 || t.text.length > 50 ? 'paragraph' : 'variable';
      t.tokens.forEach((key) => {
        if (!registeredFieldKeys.has(key)) {
          registeredFieldKeys.add(key);
          fields.push({
            key,
            label: key
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            type: key.includes('date') ? 'date' : 'text',
            required: true,
            sample: t.text.replace(/\{\{[^}]+\}\}/g, 'Sample Value'),
            mapsTo: guessFieldMapping(key),
          });
        }
      });
    } else if (t.isVariable) {
      // Auto-wrap variable text with {{token}}
      const sanitizedKey = (t.name || 'field')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30);
      const finalKey = registeredFieldKeys.has(sanitizedKey)
        ? `${sanitizedKey}_${i}`
        : sanitizedKey || `field_${i}`;

      registeredFieldKeys.add(finalKey);
      templateText = `{{${finalKey}}}`;
      fields.push({
        key: finalKey,
        label: finalKey
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        type: finalKey.includes('date') ? 'date' : 'text',
        required: true,
        sample: t.text,
        mapsTo: guessFieldMapping(finalKey),
      });
    }

    blocks.push({
      id: `blk_figma_${i}_${t.nodeId.replace(/[^a-zA-Z0-9]/g, '_')}`,
      rect: t.rect,
      text: templateText,
      style: t.style,
      role,
    });
  }

  // Ensure default recipient_name field exists if none detected
  if (!fields.some((f) => f.mapsTo === 'recipient_name')) {
    if (fields.length > 0) {
      fields[0].mapsTo = 'recipient_name';
    }
  }

  // QR placement defaults
  const finalQr: Rect = qrPlacement || {
    x: Math.round(targetWidth * 0.81),
    y: Math.round(targetHeight * 0.73),
    w: Math.round(targetWidth * 0.085),
    h: Math.round(targetWidth * 0.085),
  };

  // Inpaint variable background regions
  onProgress?.('Inpainting background regions for clean rendering...', 90);
  let finalBackgroundUrl = backgroundDataUrl;
  let erased = false;

  try {
    const pixelData = await getImagePixelData(backgroundDataUrl, targetWidth, targetHeight);
    const eraseRects = blocks.filter((b) => b.role === 'variable' || b.role === 'paragraph').map((b) => b.rect);

    if (eraseRects.length > 0) {
      const inpainted = await inpaintRegionsAsync(pixelData.data, targetWidth, targetHeight, eraseRects);
      finalBackgroundUrl = pixelDataToDataUrl(inpainted.data, targetWidth, targetHeight, 'image/jpeg', 0.92);
      erased = true;
    }
  } catch (inpaintErr) {
    console.warn('Figma background inpainting fallback:', inpaintErr);
  }

  onProgress?.('Ready!', 100);

  const spec: TemplateSpec = {
    schema: 'certichain.template/v1',
    id: `tpl_figma_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: frameDoc.name || 'Figma Certificate Template',
    createdAt: new Date().toISOString(),
    canvas: {
      width: targetWidth,
      height: targetHeight,
    },
    background: {
      mime: 'image/jpeg',
      dataUrl: finalBackgroundUrl,
      erasedBackground: erased,
    },
    blocks,
    fields,
    qr: {
      rect: finalQr,
      caption: 'Scan to verify',
      tile: true,
    },
    verifyStrip: {
      rect: {
        x: Math.round(targetWidth * 0.15),
        y: Math.round(targetHeight * 0.935),
        w: Math.round(targetWidth * 0.7),
        h: Math.round(targetHeight * 0.035),
      },
      style: {
        fontFamily: 'Inter',
        fontWeight: 500,
        fontSize: Math.max(16, Math.round(targetHeight * 0.016)),
        color: '#64748B',
        align: 'center',
        lineHeight: 1.2,
        letterSpacing: 0.5,
        transform: 'none',
        fit: 'none',
        maxLines: 1,
      },
    },
    figma: {
      fileKey,
      nodeId: targetNodeId,
      connectedAt: new Date().toISOString(),
    },
  };

  if (existingOcrSpec && existingOcrSpec.fields && existingOcrSpec.fields.length > 0) {
    return mapOcrVariablesToFigmaLayers(existingOcrSpec.fields, existingOcrSpec.blocks || [], spec);
  }

  return spec;
}

/**
 * Maps OCR-extracted variables and blocks to Figma text layers.
 * Iterates through OCR tokens (e.g. {{recipient_name}}, {{event_name}}) and matches them
 * with Figma text layers that have semantic names (e.g. recipient_name, {{recipient_name}}, name, etc.).
 * If a match is found: updates the Figma layer's text content to the variable token and preserves OCR sample/label.
 * If no match is found: creates a new text block in the Figma schema at the coordinates where OCR detected the text.
 */
export function mapOcrVariablesToFigmaLayers(
  ocrFields: TemplateField[],
  ocrBlocks: TemplateBlock[],
  figmaSpec: TemplateSpec
): TemplateSpec {
  const mergedFields: TemplateField[] = [...figmaSpec.fields];
  const mergedBlocks: TemplateBlock[] = [...figmaSpec.blocks];
  const fieldKeysInFigma = new Set(mergedFields.map((f) => f.key));

  for (const ocrField of ocrFields) {
    const tokenStr = `{{${ocrField.key}}}`;
    const cleanKey = ocrField.key.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Attempt to find a matching Figma block
    const matchIdx = mergedBlocks.findIndex((b) => {
      const lowerText = b.text.toLowerCase().replace(/[^a-z0-9]/g, '');
      const lowerId = b.id.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        b.text.includes(tokenStr) ||
        lowerId.includes(cleanKey) ||
        (cleanKey === 'recipientname' && (lowerText.includes('name') || lowerText.includes('recipient') || lowerId.includes('name'))) ||
        (cleanKey === 'eventname' && (lowerText.includes('course') || lowerText.includes('event') || lowerText.includes('workshop') || lowerId.includes('course'))) ||
        (cleanKey.includes('date') && (lowerText.includes('date') || lowerId.includes('date'))) ||
        (cleanKey.includes('cert') && (lowerText.includes('cert') || lowerId.includes('cert')))
      );
    });

    if (matchIdx >= 0) {
      const targetBlock = mergedBlocks[matchIdx];
      if (!targetBlock.text.includes(tokenStr)) {
        if (targetBlock.text.length > 50 && ocrField.sample) {
          targetBlock.text = targetBlock.text.replace(ocrField.sample, tokenStr);
        } else {
          targetBlock.text = tokenStr;
        }
      }
      targetBlock.role = targetBlock.text.length > 50 ? 'paragraph' : 'variable';

      if (!fieldKeysInFigma.has(ocrField.key)) {
        mergedFields.push(ocrField);
        fieldKeysInFigma.add(ocrField.key);
      } else {
        const fIdx = mergedFields.findIndex((f) => f.key === ocrField.key);
        if (fIdx >= 0) {
          mergedFields[fIdx] = { ...mergedFields[fIdx], ...ocrField };
        }
      }
    } else {
      // No match found in Figma frame — append the OCR block at its coordinates
      const correspondingOcrBlock = ocrBlocks.find(
        (b) => b.text.includes(tokenStr) || b.id.includes(ocrField.key)
      );
      if (correspondingOcrBlock) {
        mergedBlocks.push({
          ...correspondingOcrBlock,
          id: `blk_synced_ocr_${ocrField.key}_${Date.now().toString(36)}`,
          role: 'variable',
        });
      } else {
        mergedBlocks.push({
          id: `blk_synced_ocr_${ocrField.key}_${Date.now().toString(36)}`,
          rect: {
            x: Math.round(figmaSpec.canvas.width * 0.2),
            y: Math.round(figmaSpec.canvas.height * 0.4),
            w: Math.round(figmaSpec.canvas.width * 0.6),
            h: 40,
          },
          text: tokenStr,
          style: {
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: 600,
            fontSize: 28,
            color: '#1E293B',
            align: 'center',
            lineHeight: 1.3,
            letterSpacing: 0,
            transform: 'none',
            fit: 'shrink',
            maxLines: 2,
          },
          role: 'variable',
        });
      }

      if (!fieldKeysInFigma.has(ocrField.key)) {
        mergedFields.push(ocrField);
        fieldKeysInFigma.add(ocrField.key);
      }
    }
  }

  return {
    ...figmaSpec,
    blocks: mergedBlocks,
    fields: mergedFields,
    figma: figmaSpec.figma || {
      fileKey: 'synced_figma',
      connectedAt: new Date().toISOString(),
    },
  };
}

function guessFieldMapping(key: string): FieldMapTarget {
  const l = key.toLowerCase();
  if (l.includes('recipient') || l.includes('student') || l.includes('name')) return 'recipient_name';
  if (l.includes('title') || l.includes('course') || l.includes('credential')) return 'credential_title';
  if (l.includes('desc')) return 'description';
  if (l.includes('issue_date') || l.includes('issued')) return 'issue_date';
  if (l.includes('expiry')) return 'expiry_date';
  if (l.includes('number') || l.includes('cert_no') || l.includes('serial')) return 'certificate_number';
  if (l.includes('issuer') || l.includes('org') || l.includes('university')) return 'issuer_name';
  return 'custom';
}

/**
 * Generates exportable Figma Schema JSON for Figma plugins or roundtrip editing.
 */
export function exportTemplateToFigmaJson(spec: TemplateSpec): string {
  const figmaStructure = {
    schemaVersion: '1.0.0',
    type: 'CERTICHAIN_TEMPLATE',
    name: spec.name,
    canvas: spec.canvas,
    qrPlacement: spec.qr,
    fields: spec.fields,
    layers: spec.blocks.map((b) => ({
      name: b.text.includes('{{') ? b.text : `Block_${b.id}`,
      type: 'TEXT',
      x: b.rect.x,
      y: b.rect.y,
      width: b.rect.w,
      height: b.rect.h,
      characters: b.text,
      fontFamily: b.style.fontFamily,
      fontWeight: b.style.fontWeight,
      fontSize: b.style.fontSize,
      color: b.style.color,
      textAlign: b.style.align.toUpperCase(),
      role: b.role,
    })),
  };

  return JSON.stringify(figmaStructure, null, 2);
}
