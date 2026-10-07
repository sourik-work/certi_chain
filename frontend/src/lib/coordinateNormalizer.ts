/**
 * Coordinate Normalizer Utility
 * Converts bounding box formats (e.g. Gemini [ymin, xmin, ymax, xmax] in 0..1000 scale,
 * or pixel [x, y, w, h]) into normalized { x, y, w, h } format in 0..1 range with safety clamping.
 */

import type { NormalizedBox } from '../types/customTemplate';
import { snapToGrid } from './templateAnalysis';

/**
 * Converts Gemini 0..1000 box [ymin, xmin, ymax, xmax] to normalized { x, y, w, h } in 0..1.
 */
export function geminiBoxToNormalizedBox(box1000: [number, number, number, number]): NormalizedBox {
  const [ymin, xmin, ymax, xmax] = box1000;

  const y0 = Math.max(0, Math.min(1000, ymin)) / 1000;
  const x0 = Math.max(0, Math.min(1000, xmin)) / 1000;
  const y1 = Math.max(0, Math.min(1000, ymax)) / 1000;
  const x1 = Math.max(0, Math.min(1000, xmax)) / 1000;

  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  const w = Math.max(0.005, Math.abs(x1 - x0));
  const h = Math.max(0.005, Math.abs(y1 - y0));

  return {
    x: snapToGrid(x),
    y: snapToGrid(y),
    w: snapToGrid(Math.min(1 - x, w)),
    h: snapToGrid(Math.min(1 - y, h)),
  };
}

/**
 * Converts pixel coordinates [x, y, w, h] to normalized { x, y, w, h } given image width and height.
 */
export function pixelBoxToNormalizedBox(
  pixelBox: { x: number; y: number; w: number; h: number },
  imageWidth: number,
  imageHeight: number
): NormalizedBox {
  const x = Math.max(0, pixelBox.x / imageWidth);
  const y = Math.max(0, pixelBox.y / imageHeight);
  const w = Math.max(0.005, pixelBox.w / imageWidth);
  const h = Math.max(0.005, pixelBox.h / imageHeight);

  return {
    x: snapToGrid(x),
    y: snapToGrid(y),
    w: snapToGrid(Math.min(1 - x, w)),
    h: snapToGrid(Math.min(1 - y, h)),
  };
}

/**
 * Converts normalized { x, y, w, h } to pixel coordinates [x, y, w, h].
 */
export function normalizedBoxToPixels(
  box: NormalizedBox,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(box.x * imageWidth),
    y: Math.round(box.y * imageHeight),
    w: Math.round(box.w * imageWidth),
    h: Math.round(box.h * imageHeight),
  };
}
