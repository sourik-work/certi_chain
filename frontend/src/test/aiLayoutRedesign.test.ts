import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import Tesseract from 'tesseract.js';
import { parseTsvToWordsAndLines } from '../lib/template/ocr';
import { cleanBaseTemplate } from '../lib/cleanBase';
import { validateLayoutPlan } from '../lib/layoutValidator';
import { computeLayoutHash } from '../lib/layoutHash';
import { renderCustomCertificateCanvas } from '../lib/renderCertificate';
import type { CertificateTemplate, TemplateField } from '../types/customTemplate';

describe('AI Layout Redesign & Centre for Blockchain Technology Fixture Integration', () => {
  const fixturePath = path.resolve(__dirname, '../../../e2e/fixtures/real-sample-certificate.jpg');

  it('verifies fixture image exists and is readable', () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const buffer = fs.readFileSync(fixturePath);
    expect(buffer.length).toBeGreaterThan(50000);
  });

  it('runs OCR line extraction on Centre for Blockchain Technology certificate', async () => {
    const buffer = fs.readFileSync(fixturePath);
    const worker = await Tesseract.createWorker('eng');
    const ret = await worker.recognize(buffer, {}, { tsv: true });
    await worker.terminate();

    const canvasWidth = 1024;
    const canvasHeight = 747;
    const { words } = parseTsvToWordsAndLines(ret.data.tsv || '', 1.0, canvasWidth, canvasHeight);

    expect(words.length).toBeGreaterThanOrEqual(40);
    const textAll = words.map((w) => w.text).join(' ');
    expect(textAll.toLowerCase()).toContain('blockchain');
    expect(textAll.toLowerCase()).toContain('technology');
  });

  it('cleans base template by erasing placeholder lines and keeps heading and logos intact', async () => {
    const buffer = fs.readFileSync(fixturePath);
    const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;

    // Target box for "This is to certify that..." sentence in the sample
    const placeholderBox = { x: 0.15, y: 0.45, w: 0.7, h: 0.15 };

    const cleanResult = await cleanBaseTemplate({
      imageSource: base64,
      boxesToRemove: [placeholderBox],
      imageWidth: 1024,
      imageHeight: 747,
    });

    expect(cleanResult.cleanedDataUrl).toBeTruthy();
    expect(cleanResult.baseHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(cleanResult.width).toBe(1024);
    expect(cleanResult.height).toBe(747);
  });

  it('validates redesigned layout with compositeText sentence and token schema', async () => {
    const fields: TemplateField[] = [
      {
        key: 'certificateNumber',
        label: 'Certificate Number',
        type: 'number',
        required: true,
        box: { x: 0.18, y: 0.17, w: 0.35, h: 0.04 },
        style: {
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: 600,
          color: '#1E293B',
          align: 'left',
          letterSpacing: 0,
          lineHeight: 1.2,
          minFontSize: 10,
          maxLines: 1,
          uppercase: false,
        },
        sampleText: 'CERT-A-1001',
        confidence: 0.95,
        source: 'redesign',
      },
      {
        key: 'certificationStatement',
        label: 'Certification Statement',
        type: 'compositeText',
        required: true,
        box: { x: 0.1, y: 0.42, w: 0.8, h: 0.2 },
        compositeTemplate:
          'This is to certify that {{recipientName}} participated in the {{eventTitle}} held from {{startDate}} to {{endDate}}.',
        tokens: [
          { key: 'recipientName', label: 'Recipient Name', type: 'name', sampleValue: 'Alice Nakamoto' },
          { key: 'eventTitle', label: 'Event Title', type: 'text', sampleValue: 'Zero Knowledge Cryptography Deep Dive' },
          { key: 'startDate', label: 'Start Date', type: 'date', sampleValue: 'August 01, 2026' },
          { key: 'endDate', label: 'End Date', type: 'date', sampleValue: 'August 05, 2026' },
        ],
        style: {
          fontFamily: 'Plus Jakarta Sans',
          fontSize: 22,
          fontWeight: 400,
          color: '#334155',
          align: 'center',
          letterSpacing: 0,
          lineHeight: 1.6,
          minFontSize: 14,
          maxLines: 4,
          uppercase: false,
        },
        sampleText:
          'This is to certify that Alice Nakamoto participated in the Zero Knowledge Cryptography Deep Dive held from August 01, 2026 to August 05, 2026.',
        confidence: 0.98,
        source: 'redesign',
      },
    ];

    const safeZones = [{ x: 0.05, y: 0.15, w: 0.9, h: 0.7 }];
    const validation = validateLayoutPlan(fields, safeZones, 1024, 747);

    expect(validation.isValid).toBe(true);
    expect(validation.issues).toHaveLength(0);

    const layoutHash = await computeLayoutHash(fields);
    expect(layoutHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('renders dynamic certificate values into compositeText tokens without overflowing', async () => {
    const template: CertificateTemplate = {
      schemaVersion: 1,
      templateHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
      baseHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
      mimeType: 'image/jpeg',
      widthPx: 1024,
      heightPx: 747,
      orientation: 'landscape',
      fields: [
        {
          key: 'certificationStatement',
          label: 'Certification Statement',
          type: 'compositeText',
          required: true,
          box: { x: 0.1, y: 0.42, w: 0.8, h: 0.2 },
          compositeTemplate:
            'This is to certify that {{recipientName}} participated in the {{eventTitle}} held from {{startDate}} to {{endDate}}.',
          tokens: [
            { key: 'recipientName', label: 'Recipient Name', type: 'name' },
            { key: 'eventTitle', label: 'Event Title', type: 'text' },
            { key: 'startDate', label: 'Start Date', type: 'date' },
            { key: 'endDate', label: 'End Date', type: 'date' },
          ],
          style: {
            fontFamily: 'Inter',
            fontSize: 20,
            fontWeight: 400,
            color: '#1E293B',
            align: 'center',
            letterSpacing: 0,
            lineHeight: 1.4,
            minFontSize: 12,
            maxLines: 4,
            uppercase: false,
          },
          confidence: 0.98,
          source: 'redesign',
        },
      ],
      analysis: {
        model: 'gemini-1.5-flash',
        promptVersion: 'v1.0.0',
        analyzedAt: new Date().toISOString(),
      },
    };

    const values = {
      recipientName: 'Dr. Bartholomew Alexander Montgomery-Finch III आनंद ✨',
      eventTitle: 'Advanced Zero-Knowledge Proofs & Cryptographic Verification Workshop',
      startDate: 'October 01, 2026',
      endDate: 'October 07, 2026',
    };

    const renderResult = await renderCustomCertificateCanvas({
      template,
      values,
      targetWidth: 1024,
    });

    expect(renderResult.pngDataUrl).toBeTruthy();
    expect(renderResult.renderedHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('detects and in-paints horizontal underline blanks (____) in candidate text zones', async () => {
    // Create a synthetic image canvas with white background and dark horizontal underline strokes
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    expect(ctx).toBeTruthy();
    if (ctx) {
      ctx.fillStyle = '#FAFAFA';
      ctx.fillRect(0, 0, 800, 600);

      // Draw an unmasked underline stroke outside explicit text boxes (y = 450, x = 200..350)
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(200, 450, 150, 2); // 150px underline
    }

    const cleanResult = await cleanBaseTemplate({
      imageSource: canvas,
      boxesToRemove: [{ x: 0.2, y: 0.3, w: 0.6, h: 0.1 }], // box covers y = 180..240
      imageWidth: 800,
      imageHeight: 600,
      eraseUnderlines: true,
    });

    expect(cleanResult.cleanedDataUrl).toBeTruthy();
    expect(cleanResult.underlinesErasedCount).toBeGreaterThanOrEqual(1);
    expect(cleanResult.baseHash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
