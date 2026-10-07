/**
 * @file ocr.test.ts
 * @summary Unit tests for OCR TSV parsing, anchor generation, and style estimation.
 */

import { describe, it, expect } from 'vitest';
import { parseTsvToWordsAndLines, extractAnchoredBlocksFromOcr, estimateTextColor } from './ocr';

describe('OCR TSV Parsing & Anchor Extraction', () => {
  it('parses Tesseract TSV output into lines and words correctly', () => {
    const mockTsv = `level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext
1\t1\t0\t0\t0\t0\t0\t0\t1024\t747\t-1\t
4\t1\t1\t1\t1\t0\t200\t300\t300\t20\t-1\t
5\t1\t1\t1\t1\t1\t200\t300\t100\t20\t95.0\tCertificate
5\t1\t1\t1\t1\t2\t310\t300\t40\t20\t96.0\tNo:
5\t1\t1\t1\t1\t3\t360\t300\t140\t20\t92.0\tABC/123/2026`;

    const parsed = parseTsvToWordsAndLines(mockTsv, 1.0, 1024, 747);
    expect(parsed.lines.length).toBe(1);
    expect(parsed.words.length).toBe(3);
    expect(parsed.lines[0].text).toBe('Certificate No: ABC/123/2026');
    expect(parsed.lines[0].bbox.x0).toBe(200);
    expect(parsed.lines[0].bbox.x1).toBe(500);
  });

  it('extracts anchored blocks with valid sourceRect and sourceText', () => {
    const mockTsv = `level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext
1\t1\t0\t0\t0\t0\t0\t0\t1024\t747\t-1\t
4\t1\t1\t1\t1\t0\t200\t306\t310\t10\t-1\t
5\t1\t1\t1\t1\t1\t200\t306\t80\t10\t95.0\tCertificate
5\t1\t1\t1\t1\t2\t285\t306\t25\t10\t96.0\tNo:
5\t1\t1\t1\t1\t3\t315\t306\t195\t10\t92.0\tSASET/CBT/EVENT01/VOL11
4\t1\t1\t1\t2\t0\t200\t415\t290\t30\t-1\t
5\t1\t1\t1\t2\t1\t200\t415\t40\t30\t95.0\tOF
5\t1\t1\t1\t2\t2\t250\t415\t240\t30\t96.0\tPARTICIPATION
4\t1\t1\t1\t3\t0\t200\t470\t760\t20\t-1\t
5\t1\t1\t1\t3\t1\t200\t470\t180\t20\t95.0\tThis is to certify that
5\t1\t1\t1\t3\t2\t390\t470\t290\t20\t96.0\tMR. SOUMALYA MUKHERJEE
5\t1\t1\t1\t3\t3\t690\t470\t100\t20\t96.0\tvolunteered in the
4\t1\t1\t1\t4\t0\t200\t500\t760\t20\t-1\t
5\t1\t1\t1\t4\t1\t200\t500\t760\t20\t95.0\tBlockchain Technology - 05 Days Primer
4\t1\t1\t1\t5\t0\t200\t525\t500\t20\t-1\t
5\t1\t1\t1\t5\t1\t200\t525\t500\t20\t95.0\tCourse held from July 06th to July 10th, 2026`;

    const { lines, words } = parseTsvToWordsAndLines(mockTsv, 1.0, 1024, 747);
    const result = extractAnchoredBlocksFromOcr(lines, words, 1024, 747);

    expect(result.blocks.length).toBe(3);
    // Every block has sourceRect and sourceText
    result.blocks.forEach((b) => {
      expect(b.sourceRect).toBeDefined();
      expect(b.sourceRect!.w).toBeGreaterThan(0);
      expect(b.sourceRect!.h).toBeGreaterThan(0);
      expect(b.sourceText).toBeDefined();
      expect(b.sourceText!.length).toBeGreaterThan(0);
    });

    // Check recipient name in fields
    const nameField = result.fields.find((f) => f.key === 'recipient_name');
    expect(nameField).toBeDefined();
    expect(nameField?.sample).toBe('MR. SOUMALYA MUKHERJEE');
    expect(nameField?.mapsTo).toBe('recipient_name');
  });

  it('estimates text color correctly on synthetic dark background', () => {
    // 10x10 dark blue background (0x0F, 0x17, 0x2A) with white text in center
    const w = 10;
    const h = 10;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = 15;
      rgba[i * 4 + 1] = 23;
      rgba[i * 4 + 2] = 42;
      rgba[i * 4 + 3] = 255;
    }
    // Set 2 pixels to bright white text
    rgba[45 * 4] = 255;
    rgba[45 * 4 + 1] = 255;
    rgba[45 * 4 + 2] = 255;
    rgba[46 * 4] = 255;
    rgba[46 * 4 + 1] = 255;
    rgba[46 * 4 + 2] = 255;

    const est = estimateTextColor(rgba, w, h, { x: 0, y: 0, w: 10, h: 10 });
    expect(est.isLightOnDark).toBe(true);
    expect(est.textColor).toBe('#FFFFFF');
  });
});
