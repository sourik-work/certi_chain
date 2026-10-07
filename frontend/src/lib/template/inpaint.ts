/**
 * @file inpaint.ts
 * @summary Pure functions for background inpainting / text erasure using bilinear boundary interpolation,
 * edge feathering, and border variance checking.
 */

import { Rect } from './types';

export interface InpaintResult {
  data: Uint8ClampedArray;
  varianceWarning: boolean;
  varianceScore: number;
}

export interface InpaintOptions {
  padding?: number; // default 8px
  feather?: number; // default 4px
  varianceThreshold?: number; // default variance threshold for warning
}

/**
 * Computes the variance of the RGB values in the border ring around a rectangle.
 */
export function computeBorderVariance(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  rect: Rect,
  ringThickness: number = 4
): number {
  const { x, y, w, h } = rect;
  const rx0 = Math.max(0, x - ringThickness);
  const ry0 = Math.max(0, y - ringThickness);
  const rx1 = Math.min(width - 1, x + w + ringThickness);
  const ry1 = Math.min(height - 1, y + h + ringThickness);

  let sumR = 0, sumG = 0, sumB = 0;
  let sumSqR = 0, sumSqG = 0, sumSqB = 0;
  let count = 0;

  for (let cy = ry0; cy <= ry1; cy++) {
    for (let cx = rx0; cx <= rx1; cx++) {
      // Check if inside the ring but outside the target rect
      const insideTarget = cx >= x && cx < x + w && cy >= y && cy < y + h;
      if (!insideTarget) {
        const idx = (cy * width + cx) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        sumR += r;
        sumG += g;
        sumB += b;
        sumSqR += r * r;
        sumSqG += g * g;
        sumSqB += b * b;
        count++;
      }
    }
  }

  if (count === 0) return 0;

  const varR = (sumSqR / count) - Math.pow(sumR / count, 2);
  const varG = (sumSqG / count) - Math.pow(sumG / count, 2);
  const varB = (sumSqB / count) - Math.pow(sumB / count, 2);

  return (varR + varG + varB) / 3;
}

/**
 * Inpaints a list of rectangular regions in a raw RGBA pixel buffer using 4-edge bilinear interpolation.
 * Pure function: Does not mutate the input buffer; returns a new Uint8ClampedArray.
 */
export function inpaintRegions(
  srcPixels: Uint8ClampedArray,
  width: number,
  height: number,
  rects: Rect[],
  options: InpaintOptions = {}
): InpaintResult {
  const padding = options.padding ?? 8;
  const feather = options.feather ?? 4;
  const varianceThreshold = options.varianceThreshold ?? 400; // ~20 stddev per channel

  const out = new Uint8ClampedArray(srcPixels);
  let maxVariance = 0;
  let hasWarning = false;

  for (const rect of rects) {
    if (rect.w <= 0 || rect.h <= 0) continue;

    // Apply padding to determine bounding region to inpaint
    const inpaintX0 = Math.max(0, rect.x - padding);
    const inpaintY0 = Math.max(0, rect.y - padding);
    const inpaintX1 = Math.min(width - 1, rect.x + rect.w + padding - 1);
    const inpaintY1 = Math.min(height - 1, rect.y + rect.h + padding - 1);

    const w = inpaintX1 - inpaintX0 + 1;
    const h = inpaintY1 - inpaintY0 + 1;

    if (w <= 2 || h <= 2) continue;

    // Check variance of the surrounding border ring outside the inpaint region
    const variance = computeBorderVariance(
      srcPixels,
      width,
      height,
      { x: inpaintX0, y: inpaintY0, w, h },
      6
    );
    if (variance > maxVariance) maxVariance = variance;
    if (variance > varianceThreshold) {
      hasWarning = true;
    }

    // Outer reference boundaries to sample clean surrounding pixels
    const sampleY0 = Math.max(0, inpaintY0 - 1);
    const sampleY1 = Math.min(height - 1, inpaintY1 + 1);
    const sampleX0 = Math.max(0, inpaintX0 - 1);
    const sampleX1 = Math.min(width - 1, inpaintX1 + 1);

    for (let py = inpaintY0; py <= inpaintY1; py++) {
      const vRatio = h > 1 ? (py - inpaintY0) / (h - 1) : 0.5;

      for (let px = inpaintX0; px <= inpaintX1; px++) {
        const uRatio = w > 1 ? (px - inpaintX0) / (w - 1) : 0.5;

        // Sample horizontal outer edges at px
        const topIdx = (sampleY0 * width + px) * 4;
        const botIdx = (sampleY1 * width + px) * 4;

        const topR = srcPixels[topIdx];
        const topG = srcPixels[topIdx + 1];
        const topB = srcPixels[topIdx + 2];
        const topA = srcPixels[topIdx + 3];

        const botR = srcPixels[botIdx];
        const botG = srcPixels[botIdx + 1];
        const botB = srcPixels[botIdx + 2];
        const botA = srcPixels[botIdx + 3];

        // Linear interpolation vertically
        const vertR = topR * (1 - vRatio) + botR * vRatio;
        const vertG = topG * (1 - vRatio) + botG * vRatio;
        const vertB = topB * (1 - vRatio) + botB * vRatio;
        const vertA = topA * (1 - vRatio) + botA * vRatio;

        // Sample vertical outer edges at py
        const leftIdx = (py * width + sampleX0) * 4;
        const rightIdx = (py * width + sampleX1) * 4;

        const leftR = srcPixels[leftIdx];
        const leftG = srcPixels[leftIdx + 1];
        const leftB = srcPixels[leftIdx + 2];
        const leftA = srcPixels[leftIdx + 3];

        const rightR = srcPixels[rightIdx];
        const rightG = srcPixels[rightIdx + 1];
        const rightB = srcPixels[rightIdx + 2];
        const rightA = srcPixels[rightIdx + 3];

        // Linear interpolation horizontally
        const horizR = leftR * (1 - uRatio) + rightR * uRatio;
        const horizG = leftG * (1 - uRatio) + rightG * uRatio;
        const horizB = leftB * (1 - uRatio) + rightB * uRatio;
        const horizA = leftA * (1 - uRatio) + rightA * uRatio;

        // Bilinear blend with corner correction (Coon's patch / cross blend)
        const cornerTopLeftIdx = (sampleY0 * width + sampleX0) * 4;
        const cornerTopRightIdx = (sampleY0 * width + sampleX1) * 4;
        const cornerBotLeftIdx = (sampleY1 * width + sampleX0) * 4;
        const cornerBotRightIdx = (sampleY1 * width + sampleX1) * 4;

        const cornerR =
          srcPixels[cornerTopLeftIdx] * (1 - uRatio) * (1 - vRatio) +
          srcPixels[cornerTopRightIdx] * uRatio * (1 - vRatio) +
          srcPixels[cornerBotLeftIdx] * (1 - uRatio) * vRatio +
          srcPixels[cornerBotRightIdx] * uRatio * vRatio;
        const cornerG =
          srcPixels[cornerTopLeftIdx + 1] * (1 - uRatio) * (1 - vRatio) +
          srcPixels[cornerTopRightIdx + 1] * uRatio * (1 - vRatio) +
          srcPixels[cornerBotLeftIdx + 1] * (1 - uRatio) * vRatio +
          srcPixels[cornerBotRightIdx + 1] * uRatio * vRatio;
        const cornerB =
          srcPixels[cornerTopLeftIdx + 2] * (1 - uRatio) * (1 - vRatio) +
          srcPixels[cornerTopRightIdx + 2] * uRatio * (1 - vRatio) +
          srcPixels[cornerBotLeftIdx + 2] * (1 - uRatio) * vRatio +
          srcPixels[cornerBotRightIdx + 2] * uRatio * vRatio;
        const cornerA =
          srcPixels[cornerTopLeftIdx + 3] * (1 - uRatio) * (1 - vRatio) +
          srcPixels[cornerTopRightIdx + 3] * uRatio * (1 - vRatio) +
          srcPixels[cornerBotLeftIdx + 3] * (1 - uRatio) * vRatio +
          srcPixels[cornerBotRightIdx + 3] * uRatio * vRatio;

        let blendR = vertR + horizR - cornerR;
        let blendG = vertG + horizG - cornerG;
        let blendB = vertB + horizB - cornerB;
        let blendA = vertA + horizA - cornerA;

        // Calculate distance to nearest outer edge for feathering
        const distLeft = px - inpaintX0;
        const distRight = inpaintX1 - px;
        const distTop = py - inpaintY0;
        const distBottom = inpaintY1 - py;
        const minDist = Math.min(distLeft, distRight, distTop, distBottom);

        const targetIdx = (py * width + px) * 4;

        if (minDist < feather && feather > 0) {
          const featherWeight = minDist / feather; // 0 at edge, 1 inside
          const origR = srcPixels[targetIdx];
          const origG = srcPixels[targetIdx + 1];
          const origB = srcPixels[targetIdx + 2];
          const origA = srcPixels[targetIdx + 3];

          out[targetIdx] = Math.round(origR * (1 - featherWeight) + blendR * featherWeight);
          out[targetIdx + 1] = Math.round(origG * (1 - featherWeight) + blendG * featherWeight);
          out[targetIdx + 2] = Math.round(origB * (1 - featherWeight) + blendB * featherWeight);
          out[targetIdx + 3] = Math.round(origA * (1 - featherWeight) + blendA * featherWeight);
        } else {
          out[targetIdx] = Math.min(255, Math.max(0, Math.round(blendR)));
          out[targetIdx + 1] = Math.min(255, Math.max(0, Math.round(blendG)));
          out[targetIdx + 2] = Math.min(255, Math.max(0, Math.round(blendB)));
          out[targetIdx + 3] = Math.min(255, Math.max(0, Math.round(blendA)));
        }
      }
    }
  }

  return {
    data: out,
    varianceWarning: hasWarning,
    varianceScore: maxVariance,
  };
}

/**
 * Stringified worker code for off-main-thread inpainting execution.
 */
const INPAINT_WORKER_BODY = `
self.onmessage = function(e) {
  var data = e.data;
  var srcPixels = new Uint8ClampedArray(data.srcPixels);
  var width = data.width;
  var height = data.height;
  var rects = data.rects;
  var options = data.options || {};

  var padding = options.padding !== undefined ? options.padding : 8;
  var feather = options.feather !== undefined ? options.feather : 4;
  var varianceThreshold = options.varianceThreshold !== undefined ? options.varianceThreshold : 400;

  var out = new Uint8ClampedArray(srcPixels);
  var maxVariance = 0;
  var hasWarning = false;

  function computeVariance(pixels, w, h, rect, ringThickness) {
    var rx0 = Math.max(0, rect.x - ringThickness);
    var ry0 = Math.max(0, rect.y - ringThickness);
    var rx1 = Math.min(w - 1, rect.x + rect.w + ringThickness);
    var ry1 = Math.min(h - 1, rect.y + rect.h + ringThickness);
    var sumR = 0, sumG = 0, sumB = 0;
    var sumSqR = 0, sumSqG = 0, sumSqB = 0;
    var count = 0;
    for (var cy = ry0; cy <= ry1; cy++) {
      for (var cx = rx0; cx <= rx1; cx++) {
        var inside = cx >= rect.x && cx < rect.x + rect.w && cy >= rect.y && cy < rect.y + rect.h;
        if (!inside) {
          var idx = (cy * w + cx) * 4;
          var r = pixels[idx], g = pixels[idx+1], b = pixels[idx+2];
          sumR += r; sumG += g; sumB += b;
          sumSqR += r * r; sumSqG += g * g; sumSqB += b * b;
          count++;
        }
      }
    }
    if (count === 0) return 0;
    var varR = (sumSqR / count) - Math.pow(sumR / count, 2);
    var varG = (sumSqG / count) - Math.pow(sumG / count, 2);
    var varB = (sumSqB / count) - Math.pow(sumB / count, 2);
    return (varR + varG + varB) / 3;
  }

  for (var rIdx = 0; rIdx < rects.length; rIdx++) {
    var rect = rects[rIdx];
    if (rect.w <= 0 || rect.h <= 0) continue;
    var inpaintX0 = Math.max(0, rect.x - padding);
    var inpaintY0 = Math.max(0, rect.y - padding);
    var inpaintX1 = Math.min(width - 1, rect.x + rect.w + padding - 1);
    var inpaintY1 = Math.min(height - 1, rect.y + rect.h + padding - 1);
    var rw = inpaintX1 - inpaintX0 + 1;
    var rh = inpaintY1 - inpaintY0 + 1;
    if (rw <= 2 || rh <= 2) continue;

    var variance = computeVariance(srcPixels, width, height, { x: inpaintX0, y: inpaintY0, w: rw, h: rh }, 6);
    if (variance > maxVariance) maxVariance = variance;
    if (variance > varianceThreshold) hasWarning = true;

    var sampleY0 = Math.max(0, inpaintY0 - 1);
    var sampleY1 = Math.min(height - 1, inpaintY1 + 1);
    var sampleX0 = Math.max(0, inpaintX0 - 1);
    var sampleX1 = Math.min(width - 1, inpaintX1 + 1);

    for (var py = inpaintY0; py <= inpaintY1; py++) {
      var vRatio = rh > 1 ? (py - inpaintY0) / (rh - 1) : 0.5;
      for (var px = inpaintX0; px <= inpaintX1; px++) {
        var uRatio = rw > 1 ? (px - inpaintX0) / (rw - 1) : 0.5;
        var topIdx = (sampleY0 * width + px) * 4;
        var botIdx = (sampleY1 * width + px) * 4;
        var leftIdx = (py * width + sampleX0) * 4;
        var rightIdx = (py * width + sampleX1) * 4;

        var vertR = srcPixels[topIdx] * (1 - vRatio) + srcPixels[botIdx] * vRatio;
        var vertG = srcPixels[topIdx+1] * (1 - vRatio) + srcPixels[botIdx+1] * vRatio;
        var vertB = srcPixels[topIdx+2] * (1 - vRatio) + srcPixels[botIdx+2] * vRatio;
        var vertA = srcPixels[topIdx+3] * (1 - vRatio) + srcPixels[botIdx+3] * vRatio;

        var horizR = srcPixels[leftIdx] * (1 - uRatio) + srcPixels[rightIdx] * uRatio;
        var horizG = srcPixels[leftIdx+1] * (1 - uRatio) + srcPixels[rightIdx+1] * uRatio;
        var horizB = srcPixels[leftIdx+2] * (1 - uRatio) + srcPixels[rightIdx+2] * uRatio;
        var horizA = srcPixels[leftIdx+3] * (1 - uRatio) + srcPixels[rightIdx+3] * uRatio;

        var cornerTopLeft = (sampleY0 * width + sampleX0) * 4;
        var cornerTopRight = (sampleY0 * width + sampleX1) * 4;
        var cornerBotLeft = (sampleY1 * width + sampleX0) * 4;
        var cornerBotRight = (sampleY1 * width + sampleX1) * 4;

        var cornerR = srcPixels[cornerTopLeft] * (1 - uRatio) * (1 - vRatio) +
                      srcPixels[cornerTopRight] * uRatio * (1 - vRatio) +
                      srcPixels[cornerBotLeft] * (1 - uRatio) * vRatio +
                      srcPixels[cornerBotRight] * uRatio * vRatio;
        var cornerG = srcPixels[cornerTopLeft+1] * (1 - uRatio) * (1 - vRatio) +
                      srcPixels[cornerTopRight+1] * uRatio * (1 - vRatio) +
                      srcPixels[cornerBotLeft+1] * (1 - uRatio) * vRatio +
                      srcPixels[cornerBotRight+1] * uRatio * vRatio;
        var cornerB = srcPixels[cornerTopLeft+2] * (1 - uRatio) * (1 - vRatio) +
                      srcPixels[cornerTopRight+2] * uRatio * (1 - vRatio) +
                      srcPixels[cornerBotLeft+2] * (1 - uRatio) * vRatio +
                      srcPixels[cornerBotRight+2] * uRatio * vRatio;
        var cornerA = srcPixels[cornerTopLeft+3] * (1 - uRatio) * (1 - vRatio) +
                      srcPixels[cornerTopRight+3] * uRatio * (1 - vRatio) +
                      srcPixels[cornerBotLeft+3] * (1 - uRatio) * vRatio +
                      srcPixels[cornerBotRight+3] * uRatio * vRatio;

        var blendR = vertR + horizR - cornerR;
        var blendG = vertG + horizG - cornerG;
        var blendB = vertB + horizB - cornerB;
        var blendA = vertA + horizA - cornerA;

        var distLeft = px - inpaintX0;
        var distRight = inpaintX1 - px;
        var distTop = py - inpaintY0;
        var distBottom = inpaintY1 - py;
        var minDist = Math.min(distLeft, distRight, distTop, distBottom);

        var targetIdx = (py * width + px) * 4;
        if (minDist < feather && feather > 0) {
          var featherWeight = minDist / feather;
          out[targetIdx] = Math.round(srcPixels[targetIdx] * (1 - featherWeight) + blendR * featherWeight);
          out[targetIdx+1] = Math.round(srcPixels[targetIdx+1] * (1 - featherWeight) + blendG * featherWeight);
          out[targetIdx+2] = Math.round(srcPixels[targetIdx+2] * (1 - featherWeight) + blendB * featherWeight);
          out[targetIdx+3] = Math.round(srcPixels[targetIdx+3] * (1 - featherWeight) + blendA * featherWeight);
        } else {
          out[targetIdx] = Math.min(255, Math.max(0, Math.round(blendR)));
          out[targetIdx+1] = Math.min(255, Math.max(0, Math.round(blendG)));
          out[targetIdx+2] = Math.min(255, Math.max(0, Math.round(blendB)));
          out[targetIdx+3] = Math.min(255, Math.max(0, Math.round(blendA)));
        }
      }
    }
  }

  self.postMessage({
    data: out.buffer,
    varianceWarning: hasWarning,
    varianceScore: maxVariance,
  }, [out.buffer]);
};
`;

/**
 * Offloads inpainting to a Web Worker asynchronously to keep UI responsive.
 * Falls back to inpaintRegions if Web Worker is unavailable.
 */
export async function inpaintRegionsAsync(
  srcPixels: Uint8ClampedArray,
  width: number,
  height: number,
  rects: Rect[],
  options: InpaintOptions = {}
): Promise<InpaintResult> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof Blob === 'undefined') {
    return inpaintRegions(srcPixels, width, height, rects, options);
  }

  return new Promise((resolve) => {
    let worker: Worker | null = null;
    let blobUrl: string | null = null;

    const cleanup = () => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
    };

    try {
      const blob = new Blob([INPAINT_WORKER_BODY], { type: 'application/javascript' });
      blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl);

      worker.onmessage = (e: MessageEvent) => {
        const { data, varianceWarning, varianceScore } = e.data;
        cleanup();
        resolve({
          data: new Uint8ClampedArray(data),
          varianceWarning,
          varianceScore,
        });
      };

      worker.onerror = (err) => {
        console.warn('Inpainting Web Worker failed, using main thread fallback:', err);
        cleanup();
        resolve(inpaintRegions(srcPixels, width, height, rects, options));
      };

      // Clone or send buffer to worker
      const bufferCopy = srcPixels.slice().buffer;
      worker.postMessage(
        {
          srcPixels: bufferCopy,
          width,
          height,
          rects,
          options,
        },
        [bufferCopy]
      );
    } catch (workerErr) {
      console.warn('Failed to start Inpainting Worker, running on main thread:', workerErr);
      cleanup();
      resolve(inpaintRegions(srcPixels, width, height, rects, options));
    }
  });
}
