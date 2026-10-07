/**
 * @file healthCheck.test.ts
 * @summary Unit tests for Template Health Check module.
 */

import { describe, it, expect } from 'vitest';
import { runTemplateHealthCheck, computeRectOverlapFraction, extractTokensFromText } from './healthCheck';
import { TemplateSpec } from './types';

describe('Template Health Check Validator', () => {
  it('computes rect overlap fraction correctly', () => {
    const r1 = { x: 10, y: 10, w: 100, h: 50 };
    const r2 = { x: 10, y: 10, w: 100, h: 50 };
    expect(computeRectOverlapFraction(r1, r2)).toBe(1.0);

    const r3 = { x: 200, y: 200, w: 50, h: 50 };
    expect(computeRectOverlapFraction(r1, r3)).toBe(0);

    // Partial overlap
    const r4 = { x: 60, y: 10, w: 100, h: 50 }; // overlaps 50x50 = 2500 out of min 5000 = 0.5
    expect(computeRectOverlapFraction(r1, r4)).toBe(0.5);
  });

  it('extracts tokens from text with formats', () => {
    const text = 'Certify that {{recipient_name}} completed {{event_name}} on {{issue_date|YYYY-MM-DD}}';
    expect(extractTokensFromText(text)).toEqual(['recipient_name', 'event_name', 'issue_date']);
  });

  it('fails Check 1 and Check 2 when a template has zero blocks (old stub template)', () => {
    const stubSpec: TemplateSpec = {
      schema: 'certichain.template/v1' as any,
      id: 'stub_test',
      name: 'Stub Template',
      createdAt: new Date().toISOString(),
      canvas: { width: 1024, height: 747 },
      background: {
        mime: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,...',
        erasedBackground: false,
      },
      blocks: [],
      fields: [
        { key: 'recipient_name', label: 'Recipient Name', type: 'text', required: true, sample: 'Alice' },
      ],
      qr: { rect: { x: 800, y: 600, w: 100, h: 100 }, caption: 'Scan', tile: true },
    };

    const report = runTemplateHealthCheck(stubSpec);
    expect(report.passed).toBe(false);
    expect(report.failingCheckNames).toContain('All Form Fields Placed');
    expect(report.failingCheckNames).toContain('Recipient Name Anchored');
    expect(report.failingCheckNames).toContain('Background Erasure Quality');
  });

  it('fails Check 3 (Anchor Check) when a block has guessed coordinates without sourceRect', () => {
    const guessedSpec: TemplateSpec = {
      schema: 'certichain.template/v1' as any,
      id: 'guessed_test',
      name: 'Guessed Spec',
      createdAt: new Date().toISOString(),
      canvas: { width: 1024, height: 747 },
      background: {
        mime: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,...',
        erasedBackground: true,
      },
      blocks: [
        {
          id: 'blk_auto_recipient_name',
          rect: { x: 204, y: 224, w: 614, h: 52 }, // GUESSED 30% from top
          text: '{{recipient_name}}',
          role: 'variable',
          style: {
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: 700,
            fontSize: 45,
            color: '#065F46', // Dark green guessed color
            align: 'center',
            lineHeight: 1.3,
            letterSpacing: 2,
            transform: 'uppercase',
            fit: 'shrink',
            maxLines: 1,
          },
          // Missing sourceRect and sourceText!
        },
      ],
      fields: [
        { key: 'recipient_name', label: 'Recipient Name', type: 'text', required: true, sample: 'Alice' },
      ],
      qr: { rect: { x: 800, y: 600, w: 100, h: 100 }, caption: 'Scan', tile: true },
    };

    const report = runTemplateHealthCheck(guessedSpec);
    expect(report.passed).toBe(false);
    expect(report.failingCheckNames).toContain('Recipient Name Anchored');
    expect(report.failingCheckNames).toContain('Pixel-Anchored Source Regions');
  });

  it('passes all checks when template is fully anchored and valid', () => {
    const validSpec: TemplateSpec = {
      schema: 'certichain.template/v1' as any,
      id: 'valid_test',
      name: 'Valid Spec',
      createdAt: new Date().toISOString(),
      canvas: { width: 1024, height: 747 },
      background: {
        mime: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,...',
        erasedBackground: true,
      },
      blocks: [
        {
          id: 'blk_paragraph',
          rect: { x: 200, y: 465, w: 768, h: 82 },
          sourceRect: { x: 200, y: 465, w: 768, h: 82 },
          sourceText: 'This is to certify that MR. SOUMALYA MUKHERJEE volunteered in...',
          text: 'This is to certify that {{recipient_name}} {{role_verb}} in {{event_name}}...',
          role: 'paragraph',
          style: {
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: 400,
            fontSize: 16,
            color: '#FFFFFF',
            align: 'left',
            lineHeight: 1.4,
            letterSpacing: 0,
            transform: 'none',
            fit: 'none',
            maxLines: 4,
          },
        },
      ],
      fields: [
        { key: 'recipient_name', label: 'Recipient Name', type: 'text', required: true, sample: 'MR. SOUMALYA MUKHERJEE', mapsTo: 'recipient_name' },
        { key: 'role_verb', label: 'Role', type: 'text', required: true, sample: 'volunteered' },
        { key: 'event_name', label: 'Event Name', type: 'text', required: true, sample: 'Blockchain Training' },
      ],
      qr: { rect: { x: 440, y: 600, w: 140, h: 140 }, caption: 'Scan to verify', tile: true },
    };

    const report = runTemplateHealthCheck(validSpec, {
      imageNaturalSize: { width: 1024, height: 747 },
      eraseReportPassed: true,
    });
    expect(report.passed).toBe(true);
    expect(report.failingCheckNames).toEqual([]);
  });
});
