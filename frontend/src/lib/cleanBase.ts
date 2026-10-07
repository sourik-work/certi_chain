/**
 * Base Image Cleaning & Inpainting Engine
 * Erases specified text lines/regions by sampling the surrounding background colors and gradients,
 * feathering mask boundaries to produce a clean background template for dynamic field layout.
 */

import type { NormalizedBox } from '../types/customTemplate';
import { optimizeCanvasToDataUrl, MAX_ARTIFACT_BYTES, MAX_DIMENSION_PX } from './bytes';

export interface CleanBaseOptions {
  imageSource: HTMLImageElement | HTMLCanvasElement | string;
  boxesToRemove: NormalizedBox[];
  imageWidth: number;
  imageHeight: number;
  featherPixels?: number;
  eraseUnderlines?: boolean;
}

export interface CleanBaseResult {
  cleanedDataUrl: string;
  cleanedBlob: Blob;
  baseHash: string;
  width: number;
  height: number;
  underlinesErasedCount?: number;
}

/**
 * Samples pixel colors around the perimeter of a rectangle to determine background color or gradient.
 */
function sampleSurroundingColor(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  canvasWidth: number,
  canvasHeight: number
): { r: number; g: number; b: number } {
  const pad = 4;
  const samplePoints: Array<[number, number]> = [];

  // Top and bottom perimeter points
  for (let x = rx; x <= rx + rw; x += Math.max(4, Math.floor(rw / 10))) {
    const topY = Math.max(0, ry - pad);
    const botY = Math.min(canvasHeight - 1, ry + rh + pad);
    samplePoints.push([x, topY], [x, botY]);
  }

  // Left and right perimeter points
  for (let y = ry; y <= ry + rh; y += Math.max(4, Math.floor(rh / 6))) {
    const leftX = Math.max(0, rx - pad);
    const rightX = Math.min(canvasWidth - 1, rx + rw + pad);
    samplePoints.push([leftX, y], [rightX, y]);
  }

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (const [px, py] of samplePoints) {
    const pixel = ctx.getImageData(px, py, 1, 1).data;
    totalR += pixel[0];
    totalG += pixel[1];
    totalB += pixel[2];
    count += 1;
  }

  if (count === 0) return { r: 255, g: 255, b: 255 };

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
  };
}

/**
 * Detects and in-paints continuous horizontal underline blanks (e.g. ______) in text regions.
 */
function eraseHorizontalUnderlineStrokes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  _boxes?: NormalizedBox[]
): number {
  let erasedCount = 0;

  // Search in the central 70% of the canvas or in the vicinity of target boxes
  const minScanY = Math.floor(height * 0.25);
  const maxScanY = Math.floor(height * 0.85);
  const minScanX = Math.floor(width * 0.1);
  const maxScanX = Math.floor(width * 0.9);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const minRunLength = Math.max(30, Math.floor(width * 0.035));

  for (let y = minScanY; y <= maxScanY; y++) {
    let runStart = -1;
    let runLength = 0;
    let strokeErasedOnLine = false;

    for (let x = minScanX; x <= maxScanX; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Sample pixels directly above and below
      const topIdx = (Math.max(0, y - 4) * width + x) * 4;
      const botIdx = (Math.min(height - 1, y + 4) * width + x) * 4;
      const topLum = 0.299 * data[topIdx] + 0.587 * data[topIdx + 1] + 0.114 * data[topIdx + 2];
      const botLum = 0.299 * data[botIdx] + 0.587 * data[botIdx + 1] + 0.114 * data[botIdx + 2];
      const avgBgLum = (topLum + botLum) / 2;

      // Check contrast: stroke is substantially darker/different from local top/bottom background
      const isStrokePixel = Math.abs(lum - avgBgLum) > 20;

      if (isStrokePixel) {
        if (runStart === -1) {
          runStart = x;
          runLength = 1;
        } else {
          runLength++;
        }
      } else {
        if (runLength >= minRunLength) {
          const sampleColor = sampleSurroundingColor(ctx, runStart, y - 2, runLength, 4, width, height);
          ctx.save();
          ctx.fillStyle = `rgb(${sampleColor.r}, ${sampleColor.g}, ${sampleColor.b})`;
          ctx.fillRect(runStart - 1, y - 2, runLength + 2, 5);
          ctx.restore();
          erasedCount++;
          strokeErasedOnLine = true;
        }
        runStart = -1;
        runLength = 0;
      }
    }

    if (runLength >= minRunLength) {
      const sampleColor = sampleSurroundingColor(ctx, runStart, y - 2, runLength, 4, width, height);
      ctx.save();
      ctx.fillStyle = `rgb(${sampleColor.r}, ${sampleColor.g}, ${sampleColor.b})`;
      ctx.fillRect(runStart - 1, y - 2, runLength + 2, 5);
      ctx.restore();
      erasedCount++;
      strokeErasedOnLine = true;
    }

    if (strokeErasedOnLine) {
      y += 2; // Skip overlapping scanlines of the same stroke
    }
  }

  return erasedCount;
}

/**
 * Erases bounding boxes by inpainting with surrounding background color and soft border blending.
 */
export async function cleanBaseTemplate(options: CleanBaseOptions): Promise<CleanBaseResult> {
  const {
    imageSource,
    boxesToRemove,
    imageWidth,
    imageHeight,
    featherPixels = 3,
    eraseUnderlines = true,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  if (typeof imageSource === 'string') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      let resolved = false;
      img.onload = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      img.onerror = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      img.src = imageSource;
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 50);
    });
    ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
  } else if (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement) {
    const srcCtx = imageSource.getContext('2d');
    if (srcCtx) {
      try {
        const srcData = srcCtx.getImageData(0, 0, imageWidth, imageHeight);
        ctx.putImageData(srcData, 0, 0);
      } catch {
        ctx.drawImage(imageSource, 0, 0, imageWidth, imageHeight);
      }
    } else {
      ctx.drawImage(imageSource, 0, 0, imageWidth, imageHeight);
    }
  } else {
    ctx.drawImage(imageSource, 0, 0, imageWidth, imageHeight);
  }

  // 1. Erase each box by inpainting with background sample
  for (const box of boxesToRemove) {
    const rx = Math.max(0, Math.floor(box.x * imageWidth));
    const ry = Math.max(0, Math.floor(box.y * imageHeight));
    const rw = Math.min(imageWidth - rx, Math.ceil(box.w * imageWidth));
    const rh = Math.min(imageHeight - ry, Math.ceil(box.h * imageHeight));

    if (rw <= 0 || rh <= 0) continue;

    // Sample background color surrounding the box
    const color = sampleSurroundingColor(ctx, rx, ry, rw, rh, imageWidth, imageHeight);

    // Fill the box with sampled background
    ctx.save();
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;

    // Soft feathered inpainting
    if (featherPixels > 0) {
      ctx.filter = `blur(${featherPixels}px)`;
      ctx.fillRect(rx + featherPixels, ry + featherPixels, rw - featherPixels * 2, rh - featherPixels * 2);
      ctx.filter = 'none';
    }

    ctx.fillRect(rx, ry, rw, rh);
    ctx.restore();
  }

  // 2. Erase any remaining standalone horizontal underline blanks (e.g. ____)
  let underlinesErasedCount = 0;
  if (eraseUnderlines) {
    underlinesErasedCount = eraseHorizontalUnderlineStrokes(ctx, imageWidth, imageHeight, boxesToRemove);
  }

  const optimized = await optimizeCanvasToDataUrl(canvas, MAX_ARTIFACT_BYTES, MAX_DIMENSION_PX);
  const cleanedBlob = new Blob([optimized.bytes.buffer as ArrayBuffer], {
    type: optimized.dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
  });
  const baseHash = optimized.hash;

  return {
    cleanedDataUrl: optimized.dataUrl,
    cleanedBlob,
    baseHash,
    width: imageWidth,
    height: imageHeight,
    underlinesErasedCount,
  };
}
