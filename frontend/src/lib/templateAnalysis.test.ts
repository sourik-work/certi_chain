import { describe, it, expect } from 'vitest';
import {
  snapToGrid,
  snapBox,
  computeIoU,
  mapToAllowedFont,
  ensureUniqueKeys,
  postProcessDetectedFields,
} from './templateAnalysis';
import type { TemplateField } from '../types/customTemplate';

describe('templateAnalysis utility', () => {
  it('snaps coordinates to 0.25% grid accurately', () => {
    expect(snapToGrid(0.1234)).toBe(0.1225);
    expect(snapToGrid(0.5002)).toBe(0.5);
    expect(snapToGrid(1.5)).toBe(1);
    expect(snapToGrid(-0.2)).toBe(0);
  });

  it('snaps and clamps bounding boxes within [0..1] range', () => {
    const box = { x: 0.95, y: 0.95, w: 0.2, h: 0.2 };
    const snapped = snapBox(box);
    expect(snapped).not.toBeNull();
    expect(snapped!.x + snapped!.w).toBeLessThanOrEqual(1.0001);
    expect(snapped!.y + snapped!.h).toBeLessThanOrEqual(1.0001);
  });

  it('computes IoU overlap accurately', () => {
    const b1 = { x: 0, y: 0, w: 0.5, h: 0.5 };
    const b2 = { x: 0, y: 0, w: 0.5, h: 0.5 };
    expect(computeIoU(b1, b2)).toBe(1);

    const b3 = { x: 0.6, y: 0.6, w: 0.2, h: 0.2 };
    expect(computeIoU(b1, b3)).toBe(0);
  });

  it('maps arbitrary and serif/script fonts to allowed font families', () => {
    expect(mapToAllowedFont('Times New Roman')).toBe('Playfair Display');
    expect(mapToAllowedFont('Brush Script MT')).toBe('Great Vibes');
    expect(mapToAllowedFont('inter-bold')).toBe('Inter');
    expect(mapToAllowedFont('unknown-custom-sans')).toBe('Plus Jakarta Sans');
  });

  it('ensures unique camelCase keys across field lists', () => {
    const fields: TemplateField[] = [
      {
        key: 'Recipient Name',
        label: 'Recipient Name',
        type: 'name',
        required: true,
        box: { x: 0.1, y: 0.1, w: 0.4, h: 0.1 },
        style: null,
        confidence: 0.9,
        source: 'ai',
      },
      {
        key: 'recipient_name',
        label: 'Recipient Name 2',
        type: 'name',
        required: true,
        box: { x: 0.5, y: 0.5, w: 0.4, h: 0.1 },
        style: null,
        confidence: 0.8,
        source: 'ai',
      },
    ];

    const unique = ensureUniqueKeys(fields);
    expect(unique[0].key).toBe('recipientName');
    expect(unique[1].key).toBe('recipientName1');
  });

  it('merges/filters heavy duplicate overlaps (>0.6 IoU) preserving higher confidence', () => {
    const fields: TemplateField[] = [
      {
        key: 'fieldA',
        label: 'Field A',
        type: 'text',
        required: true,
        box: { x: 0.2, y: 0.2, w: 0.4, h: 0.1 },
        style: null,
        confidence: 0.7,
        source: 'ai',
      },
      {
        key: 'fieldB',
        label: 'Field B',
        type: 'text',
        required: true,
        box: { x: 0.205, y: 0.205, w: 0.39, h: 0.095 },
        style: null,
        confidence: 0.95,
        source: 'ai',
      },
    ];

    const processed = postProcessDetectedFields(fields);
    expect(processed.length).toBe(1);
    expect(processed[0].confidence).toBe(0.95);
  });
});
