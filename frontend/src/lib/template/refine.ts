/**
 * @file refine.ts
 * @summary Pure functions for refining bounding boxes, sampling dominant text color,
 * and estimating font properties from raw image pixel buffers.
 */

import { Rect } from './types';

export interface RefinedBlockResult {
  rect: Rect;
  colorHex: string;
  backgroundColorHex: string;
  estimatedFontSize: number;
}

export interface RefineOptions {
  ringThickness?: number; // default 4px
  colorDifferenceThreshold?: number; // default 25
  minWidth?: number; // default 8px
  minHeight?: number; // default 8px
}

/**
 * Calculates Euclidean RGB distance between two colors.
 */
function rgbDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

/**
 * Converts RGB numbers (0-255) to uppercase 6-character hex string (#RRGGBB).
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const hexR = Math.min(255, Math.max(0, Math.round(r))).toString(16).padStart(2, '0');
  const hexG = Math.min(255, Math.max(0, Math.round(g))).toString(16).padStart(2, '0');
  const hexB = Math.min(255, Math.max(0, Math.round(b))).toString(16).padStart(2, '0');
  return `#${hexR}${hexG}${hexB}`.toUpperCase();
}

/**
 * Estimates the background color by calculating the median of RGB values in a ring around the rect.
 */
export function estimateLocalBackgroundColor(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  rect: Rect,
  ringThickness: number = 4
): { r: number; g: number; b: number; hex: string } {
  const { x, y, w, h } = rect;
  const rx0 = Math.max(0, x - ringThickness);
  const ry0 = Math.max(0, y - ringThickness);
  const rx1 = Math.min(width - 1, x + w + ringThickness);
  const ry1 = Math.min(height - 1, y + h + ringThickness);

  const rVals: number[] = [];
  const gVals: number[] = [];
  const bVals: number[] = [];

  for (let cy = ry0; cy <= ry1; cy++) {
    for (let cx = rx0; cx <= rx1; cx++) {
      const insideTarget = cx >= x && cx < x + w && cy >= y && cy < y + h;
      if (!insideTarget) {
        const idx = (cy * width + cx) * 4;
        rVals.push(pixels[idx]);
        gVals.push(pixels[idx + 1]);
        bVals.push(pixels[idx + 2]);
      }
    }
  }

  if (rVals.length === 0) {
    return { r: 255, g: 255, b: 255, hex: '#FFFFFF' };
  }

  rVals.sort((a, b) => a - b);
  gVals.sort((a, b) => a - b);
  bVals.sort((a, b) => a - b);

  const mid = Math.floor(rVals.length / 2);
  const medianR = rVals[mid];
  const medianG = gVals[mid];
  const medianB = bVals[mid];

  return {
    r: medianR,
    g: medianG,
    b: medianB,
    hex: rgbToHex(medianR, medianG, medianB),
  };
}

/**
 * Refines a candidate bounding box by tightening to foreground text pixels,
 * estimating the text color from the foreground cluster, and calculating font size.
 */
export function refineCandidateBlock(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  candidateRect: Rect,
  options: RefineOptions = {}
): RefinedBlockResult {
  const ringThickness = options.ringThickness ?? 4;
  const diffThreshold = options.colorDifferenceThreshold ?? 30;
  const minWidth = options.minWidth ?? 8;
  const minHeight = options.minHeight ?? 8;

  // 1. Estimate local background
  const bg = estimateLocalBackgroundColor(pixels, width, height, candidateRect, ringThickness);

  // 2. Scan inside candidateRect to find foreground pixels
  const x0 = Math.max(0, candidateRect.x);
  const y0 = Math.max(0, candidateRect.y);
  const x1 = Math.min(width - 1, candidateRect.x + candidateRect.w - 1);
  const y1 = Math.min(height - 1, candidateRect.y + candidateRect.h - 1);

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  // Accumulator for text color sampling (cluster weighted by distance from bg)
  let textR = 0, textG = 0, textB = 0;
  let totalWeight = 0;
  let fgCount = 0;

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const idx = (cy * width + cx) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const dist = rgbDistance(r, g, b, bg.r, bg.g, bg.b);
      if (dist > diffThreshold) {
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // Weight foreground pixels that contrast strongly with the background
        const weight = Math.pow(dist, 2);
        textR += r * weight;
        textG += g * weight;
        textB += b * weight;
        totalWeight += weight;
        fgCount++;
      }
    }
  }

  // If not enough foreground pixels were found, return original rect with fallback
  if (fgCount < 4 || maxX <= minX || maxY <= minY) {
    return {
      rect: candidateRect,
      colorHex: '#000000',
      backgroundColorHex: bg.hex,
      estimatedFontSize: Math.max(12, Math.round(candidateRect.h * 0.7)),
    };
  }

  // 3. Form tightened rect with small safety margin
  const margin = 2;
  const tightX = Math.max(0, minX - margin);
  const tightY = Math.max(0, minY - margin);
  const tightW = Math.max(minWidth, Math.min(width - tightX, (maxX - minX + 1) + margin * 2));
  const tightH = Math.max(minHeight, Math.min(height - tightY, (maxY - minY + 1) + margin * 2));

  // 4. Sample dominant text color
  const finalR = totalWeight > 0 ? textR / totalWeight : 0;
  const finalG = totalWeight > 0 ? textG / totalWeight : 0;
  const finalB = totalWeight > 0 ? textB / totalWeight : 0;
  const sampledHex = rgbToHex(finalR, finalG, finalB);

  // 5. Estimate font size from tight height (cap height is ~70-80% of font size for single line)
  const estimatedFontSize = Math.max(10, Math.round(tightH * 0.75));

  return {
    rect: { x: tightX, y: tightY, w: tightW, h: tightH },
    colorHex: sampledHex,
    backgroundColorHex: bg.hex,
    estimatedFontSize,
  };
}
