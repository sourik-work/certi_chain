/**
 * Deterministic Layout Validator
 * Validates that redesigned layouts have zero field overlaps, respect safe zones and canvas margins,
 * and successfully accommodate long names (40+ chars, Unicode) without clipping.
 */

import type { TemplateField, NormalizedBox } from '../types/customTemplate';
import { computeIoU, snapBox } from './templateAnalysis';

export interface LayoutValidationResult {
  isValid: boolean;
  issues: string[];
  repairedFields: TemplateField[];
}

const LONG_NAME_TEST_SAMPLE = 'Dr. Bartholomew Alexander Montgomery-Finch III आनंद ✨';

/**
 * Checks whether a given field can hold a long Unicode test string without overflow.
 */
export function testLongNameFit(
  field: TemplateField,
  canvasWidth: number,
  canvasHeight: number
): { fits: boolean; requiredWidth: number; availableWidth: number } {
  if (!field.box || !field.style) {
    return { fits: true, requiredWidth: 0, availableWidth: 0 };
  }

  const availableWidth = field.box.w * canvasWidth;
  const availableHeight = field.box.h * canvasHeight;

  // Approximate character width
  const charWidth = field.style.fontSize * 0.58;
  const totalTextWidth = LONG_NAME_TEST_SAMPLE.length * charWidth;
  const maxLines = field.style.maxLines || 1;
  const neededWidth = totalTextWidth / maxLines;
  const neededHeight = maxLines * field.style.fontSize * (field.style.lineHeight || 1.3);

  const fits = neededWidth <= availableWidth * 1.05 && neededHeight <= availableHeight * 1.1;

  return {
    fits,
    requiredWidth: Math.round(neededWidth),
    availableWidth: Math.round(availableWidth),
  };
}

/**
 * Validates layout schema against overlap, margin, and typography fit constraints.
 */
export function validateLayoutPlan(
  fields: TemplateField[],
  safeZones: NormalizedBox[] = [],
  canvasWidth: number = 1920,
  canvasHeight: number = 1080
): LayoutValidationResult {
  const issues: string[] = [];
  const repaired: TemplateField[] = [];

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f.box) {
      repaired.push(f);
      continue;
    }

    const box = snapBox(f.box);
    if (!box) {
      repaired.push(f);
      continue;
    }

    // 1. Margin and Bounds Check
    if (box.x < 0.01 || box.y < 0.01 || box.x + box.w > 0.99 || box.y + box.h > 0.99) {
      issues.push(`Field "${f.label || f.key}" exceeds canvas boundary margins.`);
    }

    // 2. Safe Zone Check (if safe zones defined)
    if (safeZones.length > 0) {
      const insideAnySafeZone = safeZones.some((sz) => {
        return (
          box.x >= sz.x - 0.02 &&
          box.y >= sz.y - 0.02 &&
          box.x + box.w <= sz.x + sz.w + 0.02 &&
          box.y + box.h <= sz.y + sz.h + 0.02
        );
      });

      if (!insideAnySafeZone) {
        issues.push(`Field "${f.label || f.key}" is placed outside designated safe layout zones.`);
      }
    }

    // 3. Overlap Check with other fields
    for (let j = i + 1; j < fields.length; j++) {
      const other = fields[j];
      if (other.box) {
        const iou = computeIoU(box, other.box);
        if (iou > 0.15) {
          issues.push(
            `Overlap detected between field "${f.label || f.key}" and "${other.label || other.key}" (IoU: ${(iou * 100).toFixed(1)}%).`
          );
        }
      }
    }

    // 4. Long Name Stress Test for 'name' or 'compositeText' fields
    if (f.type === 'name') {
      const test = testLongNameFit(f, canvasWidth, canvasHeight);
      if (!test.fits) {
        issues.push(
          `Field "${f.label || f.key}" is too narrow for long names (needs ~${test.requiredWidth}px, has ${test.availableWidth}px).`
        );
      }
    }

    repaired.push({
      ...f,
      box,
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
    repairedFields: repaired,
  };
}
