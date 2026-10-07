/**
 * Template Analysis Post-Processing
 * Snaps bounding boxes to 0.25% grid, clamps to canvas, resolves overlaps (IoU > 0.6),
 * enforces unique keys, maps unknown fonts to allowed Google Fonts, and calculates overflow risk.
 */

import type { TemplateField, NormalizedBox, FieldStyle } from '../types/customTemplate';

export const ALLOWED_FONT_FAMILIES = [
  'Plus Jakarta Sans',
  'Inter',
  'Poppins',
  'Montserrat',
  'Outfit',
  'Playfair Display',
  'Merriweather',
  'Cinzel',
  'Cormorant Garamond',
  'Great Vibes',
  'Roboto',
  'Open Sans',
  'Lato',
  'Raleway',
];

/**
 * Snaps coordinate to 0.25% (0.0025) grid and clamps to [0..1]
 */
export function snapToGrid(val: number, step = 0.0025): number {
  const snapped = Math.round(val / step) * step;
  return Math.max(0, Math.min(1, Math.round(snapped * 10000) / 10000));
}

/**
 * Snaps and clamps a bounding box to canvas bounds
 */
export function snapBox(box: NormalizedBox | null): NormalizedBox | null {
  if (!box) return null;

  const x = snapToGrid(box.x);
  const y = snapToGrid(box.y);
  const maxW = Math.max(0.01, 1 - x);
  const maxH = Math.max(0.01, 1 - y);
  const w = Math.min(maxW, Math.max(0.01, snapToGrid(box.w)));
  const h = Math.min(maxH, Math.max(0.01, snapToGrid(box.h)));

  return { x, y, w, h };
}

/**
 * Computes Intersection over Union (IoU) of two bounding boxes.
 */
export function computeIoU(b1: NormalizedBox, b2: NormalizedBox): number {
  const xA = Math.max(b1.x, b2.x);
  const yA = Math.max(b1.y, b2.y);
  const xB = Math.min(b1.x + b1.w, b2.x + b2.w);
  const yB = Math.min(b1.y + b1.h, b2.y + b2.h);

  const interW = Math.max(0, xB - xA);
  const interH = Math.max(0, yB - yA);
  const interArea = interW * interH;

  const area1 = b1.w * b1.h;
  const area2 = b2.w * b2.h;
  const unionArea = area1 + area2 - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}

/**
 * Maps arbitrary font family name to closest whitelist font.
 */
export function mapToAllowedFont(fontName: string): string {
  if (!fontName) return 'Plus Jakarta Sans';
  const clean = fontName.toLowerCase().replace(/['"-]/g, '').trim();

  for (const allowed of ALLOWED_FONT_FAMILIES) {
    const norm = allowed.toLowerCase().replace(/['"-]/g, '');
    if (clean.includes(norm) || norm.includes(clean)) {
      return allowed;
    }
  }

  if (clean.includes('serif') || clean.includes('times') || clean.includes('garamond') || clean.includes('roman')) {
    return 'Playfair Display';
  }

  if (clean.includes('script') || clean.includes('calligraphy') || clean.includes('hand')) {
    return 'Great Vibes';
  }

  return 'Plus Jakarta Sans';
}

/**
 * Enforces camelCase format and uniqueness across field keys.
 */
export function ensureUniqueKeys(fields: TemplateField[]): TemplateField[] {
  const seenKeys = new Set<string>();

  return fields.map((f, idx) => {
    let key = f.key
      .replace(/[^a-zA-Z0-9_]/g, '')
      .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      .replace(/^([A-Z])/, (_, c) => c.toLowerCase());

    if (!key) {
      key = `field${idx + 1}`;
    }

    let finalKey = key;
    let counter = 1;
    while (seenKeys.has(finalKey)) {
      finalKey = `${key}${counter}`;
      counter += 1;
    }

    seenKeys.add(finalKey);
    return {
      ...f,
      key: finalKey,
      label: f.label || finalKey.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      box: snapBox(f.box),
      style: f.style
        ? {
            ...f.style,
            fontFamily: mapToAllowedFont(f.style.fontFamily),
          }
        : null,
    };
  });
}

/**
 * Calculates whether sample text is likely to overflow the bounding box.
 */
export function estimateOverflowRisk(
  text: string,
  box: NormalizedBox | null,
  style: FieldStyle | null,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  if (!box || !style || !text) return false;

  const boxPixelWidth = box.w * canvasWidth;
  const boxPixelHeight = box.h * canvasHeight;

  // Approximate character width as ~0.55 of fontSize for Latin
  const charWidth = style.fontSize * 0.55;
  const textWidth = text.length * charWidth;
  const maxLines = style.maxLines || 1;

  const neededWidth = textWidth / maxLines;
  const neededHeight = maxLines * style.fontSize * style.lineHeight;

  return neededWidth > boxPixelWidth * 1.1 || neededHeight > boxPixelHeight * 1.1;
}

/**
 * Master post-processing pipeline for AI-detected fields.
 */
export function postProcessDetectedFields(rawFields: TemplateField[]): TemplateField[] {
  // 1. Ensure unique sanitized keys and snapped boxes
  const uniqueFields = ensureUniqueKeys(rawFields);

  // 2. Resolve severe overlaps (IoU > 0.6) by keeping higher confidence or user-created
  const filtered: TemplateField[] = [];

  for (const f of uniqueFields) {
    if (!f.box) {
      filtered.push(f);
      continue;
    }

    const overlapIdx = filtered.findIndex((existing) => existing.box && computeIoU(f.box!, existing.box) > 0.6);

    if (overlapIdx >= 0) {
      const existing = filtered[overlapIdx];
      // If new field has higher confidence, replace
      if (f.confidence > existing.confidence) {
        filtered[overlapIdx] = f;
      }
    } else {
      filtered.push(f);
    }
  }

  return filtered;
}
