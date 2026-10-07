/**
 * Deterministic Certificate Rendering Engine
 * Renders custom certificate templates with pixel precision, auto-shrink-to-fit typography,
 * word wrapping, QR code placement, and produces high-resolution PNG & A4 PDF exports.
 */

import type { CertificateTemplate } from '../types/customTemplate';
import { ensureFontLoaded } from './fonts';
import { optimizeCanvasToDataUrl, MAX_ARTIFACT_BYTES, MAX_DIMENSION_PX } from './bytes';

export interface RenderCertificateOptions {
  template: CertificateTemplate;
  values: Record<string, string>;
  certId?: string;
  proofHash?: string;
  verificationUrl?: string;
  targetWidth?: number;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  pngBlob: Blob;
  pngDataUrl: string;
  renderedHash: string; // SHA-256 of the generated PNG bytes
  width: number;
  height: number;
}

/**
 * Auto-fits and breaks text into lines, reducing font size if it exceeds bounding box.
 */
export function calculateFittedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  initialFontSize: number,
  minFontSize: number,
  lineHeightMultiplier: number,
  maxLines: number,
  fontFamily: string,
  fontWeight: number
): { lines: string[]; fontSize: number; lineHeight: number } {
  let fontSize = initialFontSize;
  const minSize = Math.max(8, minFontSize);

  while (fontSize >= minSize) {
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    const actualLineHeight = fontSize * lineHeightMultiplier;
    const totalHeight = lines.length * actualLineHeight;

    if (lines.length <= maxLines && totalHeight <= maxHeight) {
      return { lines, fontSize, lineHeight: actualLineHeight };
    }

    fontSize -= 1;
  }

  // Fallback with minimum font size and truncation
  ctx.font = `${fontWeight} ${minSize}px "${fontFamily}", sans-serif`;
  const actualLineHeight = minSize * lineHeightMultiplier;
  return { lines: [text], fontSize: minSize, lineHeight: actualLineHeight };
}

/**
 * Renders custom certificate to an off-screen HTML5 Canvas.
 */
export async function renderCustomCertificateCanvas(
  options: RenderCertificateOptions
): Promise<RenderResult> {
  const { template, values, certId, proofHash, verificationUrl } = options;

  const originalWidth = template.widthPx || 1920;
  const originalHeight = template.heightPx || 1080;

  // Scale to high-res (minimum 1920px on long edge)
  const targetLongEdge = Math.max(1920, Math.max(originalWidth, originalHeight));
  const scale = targetLongEdge / Math.max(originalWidth, originalHeight);
  const width = Math.round(originalWidth * scale);
  const height = Math.round(originalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  // Pre-load all required fonts
  template.fields.forEach((f) => {
    if (f.style?.fontFamily) {
      ensureFontLoaded(f.style.fontFamily);
    }
  });

  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Font load error fallback
    }
  }

  // 1. Draw Background Image (Cleaned Base if available, otherwise original template preview)
  const bgSourceUrl = template.cleanedBaseDataUrl || template.previewDataUrl;
  if (bgSourceUrl) {
    const bgImg = new Image();
    bgImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      let resolved = false;
      bgImg.onload = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      bgImg.onerror = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      bgImg.src = bgSourceUrl;
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 50);
    });
    ctx.drawImage(bgImg, 0, 0, width, height);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Render Variable Fields
  for (const field of template.fields) {
    if (!field.box) continue; // Skip non-rendered metadata fields

    let val = values[field.key];

    // Handle compositeText type with template string tokens
    if (field.type === 'compositeText' && field.compositeTemplate) {
      let composite = field.compositeTemplate;
      if (field.tokens && field.tokens.length > 0) {
        for (const token of field.tokens) {
          const tokenVal = values[token.key] !== undefined ? values[token.key] : token.sampleValue || '';
          composite = composite.split(`{{${token.key}}}`).join(tokenVal);
        }
      }
      val = composite;
    }

    if (val === undefined || val === null) {
      val = field.sampleText || '';
    }

    if (field.type === 'qrCode') {
      // Handled in QR placement step
      continue;
    }

    if (field.type === 'certId' && certId) {
      val = certId;
    } else if (field.type === 'proofHash' && proofHash) {
      val = proofHash;
    }

    if (!val) continue;

    const style = field.style || {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: Math.round(originalHeight * 0.03),
      fontWeight: 500,
      color: '#1E293B',
      align: 'left',
      letterSpacing: 0,
      lineHeight: 1.2,
      minFontSize: 12,
      maxLines: 2,
      uppercase: false,
    };

    if (style.uppercase) {
      val = val.toUpperCase();
    }

    const boxX = field.box.x * width;
    const boxY = field.box.y * height;
    const boxW = field.box.w * width;
    const boxH = field.box.h * height;

    const initialFontSize = Math.round(style.fontSize * scale);
    const minFontSize = Math.round(style.minFontSize * scale);

    const { lines, fontSize, lineHeight } = calculateFittedLines(
      ctx,
      val,
      boxW,
      boxH,
      initialFontSize,
      minFontSize,
      style.lineHeight,
      style.maxLines,
      style.fontFamily,
      style.fontWeight
    );

    ctx.save();
    ctx.fillStyle = style.color || '#1E293B';
    ctx.font = `${style.fontWeight} ${fontSize}px "${style.fontFamily}", sans-serif`;
    ctx.textBaseline = 'middle';

    const totalTextHeight = lines.length * lineHeight;
    const startY = boxY + (boxH - totalTextHeight) / 2 + lineHeight / 2;

    lines.forEach((line, lineIdx) => {
      const lineY = startY + lineIdx * lineHeight;
      let lineX = boxX;

      if (style.align === 'center') {
        ctx.textAlign = 'center';
        lineX = boxX + boxW / 2;
      } else if (style.align === 'right') {
        ctx.textAlign = 'right';
        lineX = boxX + boxW;
      } else {
        ctx.textAlign = 'left';
        lineX = boxX;
      }

      ctx.fillText(line, lineX, lineY);
    });

    ctx.restore();
  }

  // 3. Render Mandatory QR Code & Human-Readable certId
  const qrField = template.fields.find((f) => f.type === 'qrCode' && f.box);
  const effectiveQrBox = qrField?.box || { x: 0.80, y: 0.74, w: 0.15, h: 0.20 };
  
  const targetCertId = certId || '0xPREVIEW00000000000000000000000000000000000000000000000000000000';
  const publicBaseUrl = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'http://localhost:5173';
  const effectiveVerificationUrl = verificationUrl || `${publicBaseUrl}/verify/${targetCertId}`;

  const { drawQrCodeToCanvas } = await import('./qrHelper');
  await drawQrCodeToCanvas(ctx, {
    verificationUrl: effectiveVerificationUrl,
    box: effectiveQrBox,
    canvasWidth: width,
    canvasHeight: height,
    isPlaceholder: !certId || certId.startsWith('0xPREVIEW') || certId.startsWith('0x0000'),
  });

  // Render certId text below QR if not explicitly placed as a field
  const certIdField = template.fields.find((f) => f.type === 'certId' && f.box);
  if (!certIdField && certId && !certId.startsWith('0xPREVIEW')) {
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.font = `600 ${Math.max(12, Math.round(height * 0.012))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const textX = Math.round((effectiveQrBox.x + effectiveQrBox.w / 2) * width);
    const textY = Math.round((effectiveQrBox.y + effectiveQrBox.h + 0.005) * height);
    ctx.fillText(`ID: ${certId.slice(0, 10)}...${certId.slice(-6)}`, textX, textY);
    ctx.restore();
  }

  const optimized = await optimizeCanvasToDataUrl(canvas, MAX_ARTIFACT_BYTES, MAX_DIMENSION_PX);
  const pngBlob = new Blob([optimized.bytes.buffer as ArrayBuffer], {
    type: optimized.dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
  });

  return {
    canvas,
    pngBlob,
    pngDataUrl: optimized.dataUrl,
    renderedHash: optimized.hash,
    width,
    height,
  };
}
