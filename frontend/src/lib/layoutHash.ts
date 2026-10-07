/**
 * Layout Hash Utility
 * Computes deterministic SHA-256 hash of canonicalized field layout definitions
 * ({ key, type, box, style }).
 */

import { computeProofHash } from './hash';
import type { TemplateField } from '../types/customTemplate';

export interface LayoutSchemaObject {
  fields: Array<{
    key: string;
    type: string;
    box: { x: number; y: number; w: number; h: number } | null;
    compositeTemplate?: string | null;
    tokens?: Array<{
      key: string;
      label: string;
      type: string;
    }> | null;
    style: {
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      color: string;
      align: 'left' | 'center' | 'right';
      letterSpacing: number;
      lineHeight: number;
      minFontSize: number;
      maxLines: number;
      uppercase: boolean;
    } | null;
  }>;
}

export function extractLayoutSchema(fields: TemplateField[]): LayoutSchemaObject {
  const sorted = [...fields].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return {
    fields: sorted.map((f) => ({
      key: f.key,
      type: f.type,
      compositeTemplate: f.compositeTemplate || null,
      tokens: f.tokens
        ? [...f.tokens]
            .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
            .map((t) => ({ key: t.key, label: t.label, type: t.type }))
        : null,
      box: f.box
        ? {
            x: Math.round(f.box.x * 10000) / 10000,
            y: Math.round(f.box.y * 10000) / 10000,
            w: Math.round(f.box.w * 10000) / 10000,
            h: Math.round(f.box.h * 10000) / 10000,
          }
        : null,
      style: f.style
        ? {
            fontFamily: f.style.fontFamily,
            fontSize: f.style.fontSize,
            fontWeight: f.style.fontWeight,
            color: f.style.color.toUpperCase(),
            align: f.style.align,
            letterSpacing: f.style.letterSpacing,
            lineHeight: f.style.lineHeight,
            minFontSize: f.style.minFontSize,
            maxLines: f.style.maxLines,
            uppercase: Boolean(f.style.uppercase),
          }
        : null,
    })),
  };
}

/**
 * Computes deterministic SHA-256 hash of the template's layout schema.
 */
export async function computeLayoutHash(fields: TemplateField[]): Promise<string> {
  const schemaObj = extractLayoutSchema(fields);
  return computeProofHash(schemaObj);
}
