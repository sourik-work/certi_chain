import { describe, it, expect } from 'vitest';
import { inpaintRegions, computeBorderVariance } from './inpaint';

describe('inpaint.ts pure inpainting logic', () => {
  it('reconstructs synthetic linear gradient with low tolerance', () => {
    const width = 100;
    const height = 100;
    const originalGradient = new Uint8ClampedArray(width * height * 4);
    const corruptedImage = new Uint8ClampedArray(width * height * 4);

    // Create a smooth 2D bilinear gradient
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = Math.round((x / width) * 150);
        const g = Math.round((y / height) * 150);
        const b = Math.round(((x + y) / (width + height)) * 150);
        const a = 255;

        originalGradient[idx] = r;
        originalGradient[idx + 1] = g;
        originalGradient[idx + 2] = b;
        originalGradient[idx + 3] = a;

        corruptedImage[idx] = r;
        corruptedImage[idx + 1] = g;
        corruptedImage[idx + 2] = b;
        corruptedImage[idx + 3] = a;
      }
    }

    // Corrupt a center rectangle with black text-like pixels
    const targetRect = { x: 30, y: 30, w: 40, h: 40 };
    for (let y = targetRect.y; y < targetRect.y + targetRect.h; y++) {
      for (let x = targetRect.x; x < targetRect.x + targetRect.w; x++) {
        const idx = (y * width + x) * 4;
        corruptedImage[idx] = 0;
        corruptedImage[idx + 1] = 0;
        corruptedImage[idx + 2] = 0;
      }
    }

    // Inpaint the corrupted area
    const result = inpaintRegions(corruptedImage, width, height, [targetRect], {
      padding: 0,
      feather: 0,
      varianceThreshold: 1500,
    });

    // Check difference in the target area between original gradient and inpainted result
    let maxDiff = 0;
    for (let y = targetRect.y + 2; y < targetRect.y + targetRect.h - 2; y++) {
      for (let x = targetRect.x + 2; x < targetRect.x + targetRect.w - 2; x++) {
        const idx = (y * width + x) * 4;
        const diffR = Math.abs(result.data[idx] - originalGradient[idx]);
        const diffG = Math.abs(result.data[idx + 1] - originalGradient[idx + 1]);
        const diffB = Math.abs(result.data[idx + 2] - originalGradient[idx + 2]);
        const pixelMax = Math.max(diffR, diffG, diffB);
        if (pixelMax > maxDiff) maxDiff = pixelMax;
      }
    }

    // Bilinear interpolation on a bilinear gradient should have very low error
    expect(maxDiff).toBeLessThanOrEqual(4);
    expect(result.varianceWarning).toBe(false);
  });

  it('detects high variance and warns on busy background', () => {
    const width = 50;
    const height = 50;
    const busyImage = new Uint8ClampedArray(width * height * 4);

    // Create high frequency checkered pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const val = (x + y) % 2 === 0 ? 255 : 0;
        busyImage[idx] = val;
        busyImage[idx + 1] = val;
        busyImage[idx + 2] = val;
        busyImage[idx + 3] = 255;
      }
    }

    const variance = computeBorderVariance(busyImage, width, height, { x: 10, y: 10, w: 20, h: 20 });
    expect(variance).toBeGreaterThan(5000);

    const result = inpaintRegions(busyImage, width, height, [{ x: 10, y: 10, w: 20, h: 20 }], {
      varianceThreshold: 400,
    });
    expect(result.varianceWarning).toBe(true);
  });
});
