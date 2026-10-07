import { describe, it, expect } from 'vitest';
import {
  geminiBoxToNormalizedBox,
  pixelBoxToNormalizedBox,
  normalizedBoxToPixels,
} from './coordinateNormalizer';

describe('Coordinate Normalizer Utility', () => {
  it('converts standard Gemini 0..1000 [ymin, xmin, ymax, xmax] to normalized { x, y, w, h }', () => {
    // Top-left: (xmin: 200, ymin: 150), Bottom-right: (xmax: 800, ymax: 350)
    const geminiBox: [number, number, number, number] = [150, 200, 350, 800];
    const normalized = geminiBoxToNormalizedBox(geminiBox);

    expect(normalized.x).toBe(0.2);
    expect(normalized.y).toBe(0.15);
    expect(normalized.w).toBe(0.6);
    expect(normalized.h).toBe(0.2);
  });

  it('handles inverted coordinate pairs safely', () => {
    // Inverted: ymax < ymin, xmax < xmin
    const invertedBox: [number, number, number, number] = [400, 700, 200, 300];
    const normalized = geminiBoxToNormalizedBox(invertedBox);

    expect(normalized.x).toBe(0.3);
    expect(normalized.y).toBe(0.2);
    expect(normalized.w).toBe(0.4);
    expect(normalized.h).toBe(0.2);
  });

  it('clamps coordinates exceeding 0..1000 boundary', () => {
    const outOfBounds: [number, number, number, number] = [-50, -100, 1200, 1100];
    const normalized = geminiBoxToNormalizedBox(outOfBounds);

    expect(normalized.x).toBe(0);
    expect(normalized.y).toBe(0);
    expect(normalized.w).toBe(1);
    expect(normalized.h).toBe(1);
  });

  it('converts pixel coordinates to normalized box and back with round-trip precision', () => {
    const imgWidth = 1920;
    const imgHeight = 1080;
    const pixelBox = { x: 384, y: 216, w: 1152, h: 432 };

    const normalized = pixelBoxToNormalizedBox(pixelBox, imgWidth, imgHeight);
    expect(normalized.x).toBe(0.2);
    expect(normalized.y).toBe(0.2);
    expect(normalized.w).toBe(0.6);
    expect(normalized.h).toBe(0.4);

    const recomputedPixels = normalizedBoxToPixels(normalized, imgWidth, imgHeight);
    expect(recomputedPixels.x).toBe(384);
    expect(recomputedPixels.y).toBe(216);
    expect(recomputedPixels.w).toBe(1152);
    expect(recomputedPixels.h).toBe(432);
  });
});
