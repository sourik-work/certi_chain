/**
 * @file diff.ts
 * @summary Pure functions for calculating pixel difference scores and generating heatmap images
 * for the template fidelity verification check.
 */

export interface DiffResult {
  score: number; // 0 to 100% (100% = identical)
  meanAbsoluteDiff: number; // 0 to 255
  heatmapDataUrl: string;
}

/**
 * Computes mean absolute pixel difference between two RGBA buffers of the same dimensions.
 * Generates an RGBA heatmap buffer where color intensity corresponds to pixel mismatch.
 */
export function computeImageDiff(
  img1Pixels: Uint8ClampedArray,
  img2Pixels: Uint8ClampedArray,
  width: number,
  height: number
): { meanDiff: number; score: number; heatmapPixels: Uint8ClampedArray } {
  const totalPixels = width * height;
  const heatmap = new Uint8ClampedArray(totalPixels * 4);

  let totalDiff = 0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const rDiff = Math.abs(img1Pixels[idx] - img2Pixels[idx]);
    const gDiff = Math.abs(img1Pixels[idx + 1] - img2Pixels[idx + 1]);
    const bDiff = Math.abs(img1Pixels[idx + 2] - img2Pixels[idx + 2]);

    const pixelDiff = (rDiff + gDiff + bDiff) / 3;
    totalDiff += pixelDiff;

    // Generate false-color heatmap (Black -> Blue -> Green -> Red -> Yellow -> White)
    if (pixelDiff < 5) {
      // Near match - dark subtle blue/grey
      heatmap[idx] = 20;
      heatmap[idx + 1] = 25;
      heatmap[idx + 2] = 35;
      heatmap[idx + 3] = 255;
    } else if (pixelDiff < 30) {
      // Slight shift (antialiasing / compression) - Cyan/Blue
      const factor = pixelDiff / 30;
      heatmap[idx] = 0;
      heatmap[idx + 1] = Math.round(150 * factor);
      heatmap[idx + 2] = 255;
      heatmap[idx + 3] = 255;
    } else if (pixelDiff < 80) {
      // Moderate shift - Yellow/Orange
      const factor = (pixelDiff - 30) / 50;
      heatmap[idx] = 255;
      heatmap[idx + 1] = Math.round(200 * (1 - factor * 0.5));
      heatmap[idx + 2] = 0;
      heatmap[idx + 3] = 255;
    } else {
      // High mismatch - Bright Red / Magenta
      heatmap[idx] = 255;
      heatmap[idx + 1] = 40;
      heatmap[idx + 2] = 60;
      heatmap[idx + 3] = 255;
    }
  }

  const meanDiff = totalDiff / totalPixels;
  // Score from 0 to 100% where 0 mean diff is 100% and mean diff >= 100 is 0%
  const score = Math.max(0, Math.min(100, Math.round((1 - meanDiff / 100) * 1000) / 10));

  return {
    meanDiff,
    score,
    heatmapPixels: heatmap,
  };
}
