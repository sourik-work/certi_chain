/**
 * @file preprocess.ts
 * @summary Pure image preprocessing for OCR (Phase 1.1).
 *
 * Implements:
 * 1. Resolution scaling (ensuring max dimension >= 2400px for high OCR accuracy).
 * 2. Grayscale conversion with luminance weights.
 * 3. Integral image & Bradley-Roth adaptive thresholding (for robust binarization on gradients).
 * 4. Normal and Inverted polarity binarization (for light text on dark gradient backgrounds).
 * 5. Edge energy / busy region detection (to discard non-text graphical banners).
 */

export interface PreprocessedImagePair {
  width: number;
  height: number;
  scaleFactor: number;
  normalBinary: Uint8ClampedArray; // 0 (black) or 255 (white)
  invertedBinary: Uint8ClampedArray;
  grayscale: Uint8ClampedArray;
}

/**
 * Converts RGBA pixel data to Grayscale (Rec. 601 luma).
 */
export function rgbaToGrayscale(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    // Y = 0.299*R + 0.587*G + 0.114*B
    gray[j] = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
  }
  return gray;
}

/**
 * Inverts grayscale pixel array (255 - value).
 */
export function invertGrayscale(gray: Uint8ClampedArray): Uint8ClampedArray {
  const inv = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    inv[i] = 255 - gray[i];
  }
  return inv;
}

/**
 * Computes 2D Integral Image for fast constant-time local window mean queries.
 */
export function computeIntegralImage(
  gray: Uint8ClampedArray,
  width: number,
  height: number
): Float64Array {
  const integral = new Float64Array(width * height);

  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      sum += gray[idx];
      if (y === 0) {
        integral[idx] = sum;
      } else {
        integral[idx] = integral[(y - 1) * width + x] + sum;
      }
    }
  }

  return integral;
}

/**
 * Adaptive Thresholding (Bradley-Roth algorithm using Integral Image).
 * Produces crisp black/white text even on complex non-uniform gradients.
 *
 * @param gray Grayscale buffer
 * @param width Image width
 * @param height Image height
 * @param windowFraction Local window size as fraction of width (typically 1/16 ~ 0.06)
 * @param percentageThreshold Threshold sensitivity (percentage below local average, e.g. 0.15 = 15%)
 */
export function adaptiveThresholdBradley(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  windowFraction = 0.06,
  percentageThreshold = 0.15
): Uint8ClampedArray {
  const binary = new Uint8ClampedArray(width * height);
  const integral = computeIntegralImage(gray, width, height);

  const s = Math.max(3, Math.round(width * windowFraction));
  const s2 = Math.floor(s / 2);
  const t = 1.0 - percentageThreshold;

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - s2);
    const y1 = Math.min(height - 1, y + s2);

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - s2);
      const x1 = Math.min(width - 1, x + s2);

      const count = (x1 - x0 + 1) * (y1 - y0 + 1);

      // Query sum from integral image: I(x1,y1) - I(x0-1,y1) - I(x1,y0-1) + I(x0-1,y0-1)
      let sum = integral[y1 * width + x1];
      if (x0 > 0) sum -= integral[y1 * width + (x0 - 1)];
      if (y0 > 0) sum -= integral[(y0 - 1) * width + x1];
      if (x0 > 0 && y0 > 0) sum += integral[(y0 - 1) * width + (x0 - 1)];

      const idx = y * width + x;
      // If pixel is significantly darker than local average, mark black (0), else white (255)
      if (gray[idx] * count < sum * t) {
        binary[idx] = 0;
      } else {
        binary[idx] = 255;
      }
    }
  }

  return binary;
}

/**
 * Computes localized edge energy (gradient magnitude) to detect busy geometric / decorative banners.
 */
export function computeLocalEdgeEnergy(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number }
): number {
  let totalEnergy = 0;
  let count = 0;

  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(width - 2, rect.x + rect.w);
  const y1 = Math.min(height - 2, rect.y + rect.h);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = y * width + x;
      const dx = Math.abs(gray[idx + 1] - gray[idx]);
      const dy = Math.abs(gray[(y + 1) * width + x] - gray[idx]);
      totalEnergy += Math.sqrt(dx * dx + dy * dy);
      count++;
    }
  }

  return count > 0 ? totalEnergy / count : 0;
}

/**
 * Bilinear image resize for typed RGBA arrays.
 */
export function resizeRgba(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number
): Uint8ClampedArray {
  const dest = new Uint8ClampedArray(dw * dh * 4);
  const xRatio = (sw - 1) / Math.max(1, dw - 1);
  const yRatio = (sh - 1) / Math.max(1, dh - 1);

  for (let dy = 0; dy < dh; dy++) {
    const sy = dy * yRatio;
    const sy0 = Math.floor(sy);
    const sy1 = Math.min(sh - 1, sy0 + 1);
    const yDiff = sy - sy0;

    for (let dx = 0; dx < dw; dx++) {
      const sx = dx * xRatio;
      const sx0 = Math.floor(sx);
      const sx1 = Math.min(sw - 1, sx0 + 1);
      const xDiff = sx - sx0;

      const destIdx = (dy * dw + dx) * 4;

      const idx00 = (sy0 * sw + sx0) * 4;
      const idx10 = (sy0 * sw + sx1) * 4;
      const idx01 = (sy1 * sw + sx0) * 4;
      const idx11 = (sy1 * sw + sx1) * 4;

      for (let c = 0; c < 4; c++) {
        const val =
          src[idx00 + c] * (1 - xDiff) * (1 - yDiff) +
          src[idx10 + c] * xDiff * (1 - yDiff) +
          src[idx01 + c] * (1 - xDiff) * yDiff +
          src[idx11 + c] * xDiff * yDiff;
        dest[destIdx + c] = Math.round(val);
      }
    }
  }

  return dest;
}

/**
 * Full preprocessing pipeline for light-on-dark certificate text OCR.
 */
export function preprocessImageForOcr(
  rgba: Uint8ClampedArray,
  naturalWidth: number,
  naturalHeight: number,
  minDimension = 2400
): PreprocessedImagePair {
  const longSide = Math.max(naturalWidth, naturalHeight);
  let scaleFactor = 1.0;
  let workRgba = rgba;
  let workWidth = naturalWidth;
  let workHeight = naturalHeight;

  if (longSide < minDimension) {
    scaleFactor = minDimension / longSide;
    workWidth = Math.round(naturalWidth * scaleFactor);
    workHeight = Math.round(naturalHeight * scaleFactor);
    workRgba = resizeRgba(rgba, naturalWidth, naturalHeight, workWidth, workHeight);
  }

  const grayscale = rgbaToGrayscale(workRgba, workWidth, workHeight);
  const invertedGrayscale = invertGrayscale(grayscale);

  // Normal polarity binarization (Dark text on light background)
  const normalBinary = adaptiveThresholdBradley(grayscale, workWidth, workHeight, 0.05, 0.12);

  // Inverted polarity binarization (Light text on dark gradient, e.g. white/yellow text on dark navy)
  const invertedBinary = adaptiveThresholdBradley(invertedGrayscale, workWidth, workHeight, 0.05, 0.12);

  return {
    width: workWidth,
    height: workHeight,
    scaleFactor,
    normalBinary,
    invertedBinary,
    grayscale,
  };
}
