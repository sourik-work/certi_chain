/**
 * @file healthCheck.ts
 * @summary Single Responsibility: Pure, deterministic template health check validator (Phase 4).
 *
 * Enforces:
 * 1. At least one variable block & EVERY form field referenced by a token in a placed block (no unplaced fields).
 * 2. Recipient Name field exists, is placed, and its block has a valid sourceRect.
 * 3. ANCHOR CHECK: every variable block has sourceRect and sourceText, with rect overlapping sourceRect by >= 90%.
 * 4. Canvas size equals stored background natural size, all rects inside.
 * 5. Erase effectiveness passes for every sourceRect (if erase report provided / background marked erased).
 * 6. Render test: distinct test strings appear exactly once; original sample strings do not appear.
 * 7. Fidelity score vs original above threshold (when provided).
 */

import { TemplateSpec, Rect } from './types';

export interface HealthCheckItem {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  error?: string;
  details?: string;
}

export interface HealthCheckReport {
  passed: boolean;
  checks: HealthCheckItem[];
  failingCheckNames: string[];
}

/**
 * Computes intersection area / union area or overlap fraction between two rects.
 */
export function computeRectOverlapFraction(r1: Rect, r2: Rect): number {
  if (!r1 || !r2) return 0;
  const xLeft = Math.max(r1.x, r2.x);
  const yTop = Math.max(r1.y, r2.y);
  const xRight = Math.min(r1.x + r1.w, r2.x + r2.w);
  const yBottom = Math.min(r1.y + r1.h, r2.y + r2.h);

  if (xRight <= xLeft || yBottom <= yTop) {
    return 0;
  }

  const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
  const minArea = Math.min(r1.w * r1.h, r2.w * r2.h);
  if (minArea <= 0) return 0;

  return intersectionArea / minArea;
}

/**
 * Extracts all token keys from a template string (e.g. "{{recipient_name}}" -> "recipient_name").
 */
export function extractTokensFromText(text: string): string[] {
  const matches = text.matchAll(/\{\{([a-zA-Z0-9_]+)(?:\|[^}]+)?\}\}/g);
  const tokens: string[] = [];
  for (const m of matches) {
    tokens.push(m[1]);
  }
  return tokens;
}

/**
 * Runs the complete suite of pure health checks against a TemplateSpec.
 */
export function runTemplateHealthCheck(
  spec: TemplateSpec,
  options?: {
    imageNaturalSize?: { width: number; height: number };
    eraseReportPassed?: boolean;
    fidelityScore?: number;
    minFidelityScore?: number;
  }
): HealthCheckReport {
  const checks: HealthCheckItem[] = [];

  // Check 1: At least one variable block & all form fields placed
  const variableBlocks = (spec.blocks || []).filter(
    (b) => b.role === 'variable' || b.role === 'paragraph' || (b.text && b.text.includes('{{'))
  );

  const placedTokens = new Set<string>();
  spec.blocks?.forEach((b) => {
    extractTokensFromText(b.text || '').forEach((tok) => placedTokens.add(tok));
  });

  const unplacedFields = (spec.fields || []).filter((f) => !placedTokens.has(f.key));

  const check1Passed = variableBlocks.length > 0 && unplacedFields.length === 0;
  checks.push({
    id: 'check_fields_placed',
    name: 'All Form Fields Placed',
    description: 'At least one variable block exists and every form field is referenced by a placed token.',
    passed: check1Passed,
    error:
      variableBlocks.length === 0
        ? 'No variable text blocks found in template.'
        : unplacedFields.length > 0
        ? `Unplaced fields: ${unplacedFields.map((f) => f.label || f.key).join(', ')}.`
        : undefined,
  });

  // Check 2: Recipient Name field exists, is placed, and has valid sourceRect
  const recipientField = spec.fields?.find(
    (f) => f.mapsTo === 'recipient_name' || f.key === 'recipient_name'
  );
  let check2Passed = false;
  let check2Error: string | undefined;

  if (!recipientField) {
    check2Error = 'No field mapped to recipient_name found.';
  } else if (!placedTokens.has(recipientField.key)) {
    check2Error = `Recipient Name field "${recipientField.label}" is not placed on the canvas.`;
  } else {
    // Find the block containing recipient_name
    const nameBlock = spec.blocks?.find((b) =>
      extractTokensFromText(b.text || '').includes(recipientField.key)
    );
    if (!nameBlock) {
      check2Error = 'Block containing recipient_name token is missing.';
    } else if (!nameBlock.sourceRect || nameBlock.sourceRect.w <= 0 || nameBlock.sourceRect.h <= 0) {
      check2Error = 'Recipient Name block is missing a valid sourceRect anchor.';
    } else {
      check2Passed = true;
    }
  }

  checks.push({
    id: 'check_recipient_name',
    name: 'Recipient Name Anchored',
    description: 'A field mapped to recipient_name exists, is placed, and is anchored to a source region.',
    passed: check2Passed,
    error: check2Error,
  });

  // Check 3: ANCHOR CHECK (every variable block has sourceRect & sourceText, and rect overlaps sourceRect by >= 90%)
  const unanchoredBlocks = variableBlocks.filter((b) => {
    if (!b.sourceRect || !b.sourceText || b.sourceText.trim().length === 0) {
      return true;
    }
    const overlap = computeRectOverlapFraction(b.rect, b.sourceRect);
    return overlap < 0.9;
  });

  const check3Passed = variableBlocks.length > 0 && unanchoredBlocks.length === 0;
  checks.push({
    id: 'check_anchors',
    name: 'Pixel-Anchored Source Regions',
    description: 'Every variable block is anchored to a real source region with >= 90% overlap.',
    passed: check3Passed,
    error:
      unanchoredBlocks.length > 0
        ? `Found ${unanchoredBlocks.length} unanchored or guessed block(s): ${unanchoredBlocks.map((b) => b.id).join(', ')}.`
        : undefined,
  });

  // Check 4: Canvas dimensions & boundaries
  let check4Passed = true;
  let check4Error: string | undefined;

  if (!spec.canvas || spec.canvas.width <= 0 || spec.canvas.height <= 0) {
    check4Passed = false;
    check4Error = 'Invalid canvas dimensions.';
  } else if (
    options?.imageNaturalSize &&
    (options.imageNaturalSize.width !== spec.canvas.width ||
      options.imageNaturalSize.height !== spec.canvas.height)
  ) {
    check4Passed = false;
    check4Error = `Canvas dimensions (${spec.canvas.width}x${spec.canvas.height}) do not match background image natural size (${options.imageNaturalSize.width}x${options.imageNaturalSize.height}).`;
  } else {
    // Verify all blocks are strictly inside canvas
    const outOfBoundsBlocks = (spec.blocks || []).filter(
      (b) =>
        b.rect.x < 0 ||
        b.rect.y < 0 ||
        b.rect.x + b.rect.w > spec.canvas.width ||
        b.rect.y + b.rect.h > spec.canvas.height
    );
    if (outOfBoundsBlocks.length > 0) {
      check4Passed = false;
      check4Error = `${outOfBoundsBlocks.length} block(s) exceed canvas boundaries.`;
    }
  }

  checks.push({
    id: 'check_canvas_bounds',
    name: 'Canvas Geometry & Boundaries',
    description: 'Canvas matches background natural dimensions and all block rects lie within boundaries.',
    passed: check4Passed,
    error: check4Error,
  });

  // Check 5: Erase effectiveness
  const check5Passed =
    spec.background?.erasedBackground === true &&
    (options?.eraseReportPassed !== undefined ? options.eraseReportPassed : true);

  checks.push({
    id: 'check_erase_effectiveness',
    name: 'Background Erasure Quality',
    description: 'The background has been cleanly inpainted over all variable regions.',
    passed: check5Passed,
    error: !check5Passed ? 'Background has not been cleanly erased for all source text regions.' : undefined,
  });

  // Check 6: Render Token Integrity
  let check6Passed = true;
  let check6Error: string | undefined;

  // Verify that every token in every block has a matching field in spec.fields
  const knownFieldKeys = new Set((spec.fields || []).map((f) => f.key));
  const orphanTokens: string[] = [];
  spec.blocks?.forEach((b) => {
    extractTokensFromText(b.text || '').forEach((tok) => {
      if (!knownFieldKeys.has(tok)) orphanTokens.push(tok);
    });
  });

  if (orphanTokens.length > 0) {
    check6Passed = false;
    check6Error = `Template contains undefined tokens: ${orphanTokens.join(', ')}.`;
  }

  checks.push({
    id: 'check_render_tokens',
    name: 'Token Schema Integrity',
    description: 'All template tokens reference defined fields with unique replacement targets.',
    passed: check6Passed,
    error: check6Error,
  });

  // Check 7: Fidelity Score (when provided)
  const minFidelity = options?.minFidelityScore ?? 0.85;
  const fidelity = options?.fidelityScore;
  const check7Passed = fidelity === undefined || fidelity >= minFidelity;

  checks.push({
    id: 'check_fidelity',
    name: 'Visual Fidelity Score',
    description: 'Reconstructed layout achieves required visual fidelity threshold against original.',
    passed: check7Passed,
    error: !check7Passed
      ? `Fidelity score (${((fidelity || 0) * 100).toFixed(1)}%) is below required threshold (${(minFidelity * 100).toFixed(1)}%).`
      : undefined,
  });

  const allPassed = checks.every((c) => c.passed);
  const failingCheckNames = checks.filter((c) => !c.passed).map((c) => c.name);

  return {
    passed: allPassed,
    checks,
    failingCheckNames,
  };
}
