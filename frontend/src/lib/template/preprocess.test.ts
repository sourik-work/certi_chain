/**
 * @file preprocess.test.ts
 * @summary Unit tests for image preprocessing and polarity binarization.
 */

import { describe, it, expect } from 'vitest';
import {
  rgbaToGrayscale,
  invertGrayscale,
  computeIntegralImage,
  adaptiveThresholdBradley,
  computeLocalEdgeEnergy,
  preprocessImageForOcr,
} from './preprocess';

describe('OCR Image Preprocessing Module', () => {
  it('converts RGBA to Grayscale with correct luma weights', () => {
    // Pure Red: (255, 0, 0, 255) -> ~76
    // Pure Green: (0, 255, 0, 255) -> ~150
    // Pure Blue: (0, 0, 255, 255) -> ~29
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255,
    ]);
    const gray = rgbaToGrayscale(rgba, 2, 2);
    expect(gray.length).toBe(4);
    expect(gray[0]).toBe(76);
    expect(gray[1]).toBe(150);
    expect(gray[2]).toBe(29);
    expect(gray[3]).toBe(255);
  });

  it('inverts grayscale pixels correctly', () => {
    const gray = new Uint8ClampedArray([0, 50, 200, 255]);
    const inv = invertGrayscale(gray);
    expect(inv[0]).toBe(255);
    expect(inv[1]).toBe(205);
    expect(inv[2]).toBe(55);
    expect(inv[3]).toBe(0);
  });

  it('computes 2D integral image correctly', () => {
    // 2x2 image:
    // [ 10, 20 ]
    // [ 30, 40 ]
    const gray = new Uint8ClampedArray([10, 20, 30, 40]);
    const integral = computeIntegralImage(gray, 2, 2);
    expect(integral[0]).toBe(10); // (0,0)
    expect(integral[1]).toBe(30); // (1,0) = 10 + 20
    expect(integral[2]).toBe(40); // (0,1) = 10 + 30
    expect(integral[3]).toBe(100); // (1,1) = 10 + 20 + 30 + 40
  });

  it('binarizes light text on dark background under inverted polarity', () => {
    // Create a 10x10 dark background (value 20) with a light text patch in the center (value 220)
    const w = 10;
    const h = 10;
    const gray = new Uint8ClampedArray(w * h);
    gray.fill(20);

    // Center 2x2 light text patch
    gray[4 * w + 4] = 220;
    gray[4 * w + 5] = 220;
    gray[5 * w + 4] = 220;
    gray[5 * w + 5] = 220;

    const inv = invertGrayscale(gray);
    const binary = adaptiveThresholdBradley(inv, w, h, 0.5, 0.1);

    // In the inverted threshold, the text pixels (originally light, now dark in inv) should be segmented as 0 (black ink)
    expect(binary[4 * w + 4]).toBe(0);
    expect(binary[4 * w + 5]).toBe(0);
    // Background pixels should be white (255)
    expect(binary[0]).toBe(255);
  });

  it('computes local edge energy to measure busy regions', () => {
    // Smooth region: all same values -> 0 edge energy
    const smooth = new Uint8ClampedArray(100).fill(128);
    const smoothEnergy = computeLocalEdgeEnergy(smooth, 10, 10, { x: 1, y: 1, w: 8, h: 8 });
    expect(smoothEnergy).toBe(0);

    // High edge region (checkerboard pattern)
    const busy = new Uint8ClampedArray(100);
    for (let i = 0; i < 100; i++) busy[i] = i % 2 === 0 ? 0 : 255;
    const busyEnergy = computeLocalEdgeEnergy(busy, 10, 10, { x: 1, y: 1, w: 8, h: 8 });
    expect(busyEnergy).toBeGreaterThan(100);
  });

  it('upscales low-resolution images to >= 2400px during preprocessing', () => {
    const w = 400;
    const h = 300;
    const rgba = new Uint8ClampedArray(w * h * 4).fill(120);

    const result = preprocessImageForOcr(rgba, w, h, 2400);
    expect(result.width).toBe(2400);
    expect(result.height).toBe(1800);
    expect(result.scaleFactor).toBe(6);
    expect(result.normalBinary.length).toBe(2400 * 1800);
    expect(result.invertedBinary.length).toBe(2400 * 1800);
  });
});
