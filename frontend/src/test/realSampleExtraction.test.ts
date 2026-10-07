/**
 * @file realSampleExtraction.test.ts
 * @summary Real-image fixture test for OCR extraction and anchor verification against real-sample-certificate.jpg (Phase 1 & 7.2).
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import Tesseract from 'tesseract.js';
import { parseTsvToWordsAndLines, extractAnchoredBlocksFromOcr } from '../lib/template/ocr';
import { runTemplateHealthCheck } from '../lib/template/healthCheck';
import { mapOcrVariablesToFigmaLayers } from '../lib/template/figma';
import { TemplateSpec } from '../lib/template/types';

describe('Real Certificate Fixture Extraction & Tolerance Verification', () => {
  const fixturePath = path.resolve(__dirname, '../../../e2e/fixtures/real-sample-certificate.jpg');

  it('verifies fixture existence, type and dimensions', () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const buffer = fs.readFileSync(fixturePath);
    expect(buffer.length).toBe(146601);
    const magic = buffer.slice(0, 4).toString('hex').toUpperCase();
    expect(magic).toBe('FFD8FFE0');
  });

  it('runs OCR on real-sample-certificate.jpg and extracts anchored blocks within reference tolerances', async () => {
    const buffer = fs.readFileSync(fixturePath);
    const worker = await Tesseract.createWorker('eng');
    const ret = await worker.recognize(buffer, {}, { tsv: true });
    await worker.terminate();

    const canvasWidth = 1024;
    const canvasHeight = 747;

    const { lines, words } = parseTsvToWordsAndLines(ret.data.tsv || '', 1.0, canvasWidth, canvasHeight);

    expect(words.length).toBeGreaterThanOrEqual(50);
    const extractedText = words.map((w) => w.text).join(' ');
    expect(extractedText).toContain('Blockchain');
    expect(extractedText).toContain('Technology');

    const result = extractAnchoredBlocksFromOcr(lines, words, canvasWidth, canvasHeight);

    // 1. Assert required blocks exist
    expect(result.blocks.length).toBeGreaterThanOrEqual(2);

    const certNoBlock = result.blocks.find((b) => b.text.includes('certificate_number'));
    const paraBlock = result.blocks.find((b) => b.text.includes('recipient_name'));

    expect(certNoBlock).toBeDefined();
    expect(paraBlock).toBeDefined();

    // 2. Tolerance checks vs Phase 1.6 reference regions (+- 3% tolerance)
    if (certNoBlock) {
      const x0Frac = certNoBlock.rect.x / canvasWidth;
      const x1Frac = (certNoBlock.rect.x + certNoBlock.rect.w) / canvasWidth;
      const y0Frac = certNoBlock.rect.y / canvasHeight;
      const y1Frac = (certNoBlock.rect.y + certNoBlock.rect.h) / canvasHeight;

      expect(Math.abs(x0Frac - 0.195)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(x1Frac - 0.505)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(y0Frac - 0.400)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(y1Frac - 0.432)).toBeLessThanOrEqual(0.03);
    }

    if (paraBlock) {
      const x0Frac = paraBlock.rect.x / canvasWidth;
      const x1Frac = (paraBlock.rect.x + paraBlock.rect.w) / canvasWidth;
      const y0Frac = paraBlock.rect.y / canvasHeight;
      const y1Frac = (paraBlock.rect.y + paraBlock.rect.h) / canvasHeight;

      expect(Math.abs(x0Frac - 0.195)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(x1Frac - 0.945)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(y0Frac - 0.622)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(y1Frac - 0.732)).toBeLessThanOrEqual(0.03);
    }

    // 3. Health Check passes
    const constructedSpec: TemplateSpec = {
      schema: 'certichain.template/v1',
      id: 'tpl_real_fixture',
      name: 'Centre for Blockchain Technology Certificate',
      createdAt: new Date().toISOString(),
      canvas: { width: canvasWidth, height: canvasHeight },
      background: {
        mime: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,...',
        erasedBackground: true,
      },
      blocks: result.blocks,
      fields: result.fields,
      qr: {
        rect: { x: 464, y: 600, w: 95, h: 95 },
        caption: 'Scan to verify',
        tile: true,
      },
    };

    const health = runTemplateHealthCheck(constructedSpec, {
      imageNaturalSize: { width: canvasWidth, height: canvasHeight },
      eraseReportPassed: true,
    });

    expect(health.passed).toBe(true);
    expect(health.failingCheckNames).toEqual([]);
  }, 30000);

  it('maps OCR variables from real certificate fixture to Figma frame template', async () => {
    const buffer = fs.readFileSync(fixturePath);
    const worker = await Tesseract.createWorker('eng');
    const ret = await worker.recognize(buffer, {}, { tsv: true });
    await worker.terminate();

    const canvasWidth = 1024;
    const canvasHeight = 747;
    const { lines, words } = parseTsvToWordsAndLines(ret.data.tsv || '', 1.0, canvasWidth, canvasHeight);
    const ocrResult = extractAnchoredBlocksFromOcr(lines, words, canvasWidth, canvasHeight);

    const mockFigmaArtboard: TemplateSpec = {
      schema: 'certichain.template/v1',
      id: 'tpl_figma_cbt',
      name: 'Centre for Blockchain Technology - Official Figma Design',
      createdAt: new Date().toISOString(),
      canvas: { width: 1920, height: 1080 },
      background: {
        mime: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,mock',
        erasedBackground: true,
      },
      blocks: [
        {
          id: 'blk_figma_recipient_name',
          rect: { x: 380, y: 550, w: 1160, h: 60 },
          text: 'STUDENT_NAME',
          style: {
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: 700,
            fontSize: 34,
            color: '#0F172A',
            align: 'center',
            lineHeight: 1.2,
            letterSpacing: 0,
            transform: 'none',
            fit: 'shrink',
            maxLines: 2,
          },
          role: 'fixed',
        },
      ],
      fields: [],
      qr: {
        rect: { x: 1550, y: 790, w: 160, h: 160 },
        caption: 'Scan to verify',
        tile: true,
      },
    };

    const synced = mapOcrVariablesToFigmaLayers(ocrResult.fields, ocrResult.blocks, mockFigmaArtboard);

    expect(synced.fields.length).toBeGreaterThanOrEqual(1);
    expect(synced.figma?.fileKey).toBeDefined();
    expect(synced.blocks.some((b) => b.text.includes('{{recipient_name}}'))).toBe(true);
  }, 30000);
});
