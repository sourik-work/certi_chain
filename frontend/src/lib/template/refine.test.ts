import { describe, it, expect } from 'vitest';
import { refineCandidateBlock, estimateLocalBackgroundColor, rgbToHex } from './refine';

describe('refine.ts pure refinement and color sampling', () => {
  it('converts rgb to hex properly', () => {
    expect(rgbToHex(255, 0, 128)).toBe('#FF0080');
    expect(rgbToHex(6, 95, 70)).toBe('#065F46');
  });

  it('estimates local background color from surrounding ring', () => {
    const width = 100;
    const height = 100;
    const img = new Uint8ClampedArray(width * height * 4);

    // Fill with cream color #F8FAFC (248, 250, 252)
    for (let i = 0; i < width * height; i++) {
      img[i * 4] = 248;
      img[i * 4 + 1] = 250;
      img[i * 4 + 2] = 252;
      img[i * 4 + 3] = 255;
    }

    const bg = estimateLocalBackgroundColor(img, width, height, { x: 20, y: 20, w: 60, h: 20 });
    expect(bg.hex).toBe('#F8FAFC');
  });

  it('tightens a loose bounding box around synthetic text and samples text color', () => {
    const width = 100;
    const height = 100;
    const img = new Uint8ClampedArray(width * height * 4);

    // Background: White
    img.fill(255);

    // Draw dark green text pixels inside a smaller sub-rect (x: 40..60, y: 40..50)
    // Dark green: R=6, G=95, B=70 (#065F46)
    for (let y = 40; y <= 50; y++) {
      for (let x = 40; x <= 60; x++) {
        const idx = (y * width + x) * 4;
        img[idx] = 6;
        img[idx + 1] = 95;
        img[idx + 2] = 70;
        img[idx + 3] = 255;
      }
    }

    // Pass an oversized candidate rect (x: 20..80, y: 20..80)
    const looseRect = { x: 20, y: 20, w: 60, h: 60 };
    const refined = refineCandidateBlock(img, width, height, looseRect);

    // Bounding box should tighten around the text
    expect(refined.rect.x).toBeGreaterThanOrEqual(36);
    expect(refined.rect.x).toBeLessThanOrEqual(40);
    expect(refined.rect.y).toBeGreaterThanOrEqual(36);
    expect(refined.rect.y).toBeLessThanOrEqual(40);
    expect(refined.rect.w).toBeLessThan(40); // Much smaller than original 60
    expect(refined.rect.h).toBeLessThan(30); // Much smaller than original 60

    // Sampled color should match dark green
    expect(refined.colorHex).toBe('#065F46');
  });
});
