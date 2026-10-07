import { describe, it, expect } from 'vitest';
import { validateTemplateSpec } from './schema';
import { SAMPLE_TEMPLATE_SPEC } from './sampleSpec';
import { TemplateSpec } from './types';

describe('schema.ts security and schema validation', () => {
  it('accepts a valid sample template specification', () => {
    const res = validateTemplateSpec(SAMPLE_TEMPLATE_SPEC);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('rejects SVG data URLs for security reasons', () => {
    const invalidSpec: TemplateSpec = {
      ...SAMPLE_TEMPLATE_SPEC,
      background: {
        mime: 'image/jpeg',
        dataUrl: 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+',
        erasedBackground: false,
      },
    };
    const res = validateTemplateSpec(invalidSpec);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('SVG'))).toBe(true);
  });

  it('rejects out-of-bounds bounding boxes', () => {
    const invalidSpec: TemplateSpec = {
      ...SAMPLE_TEMPLATE_SPEC,
      blocks: [
        {
          ...SAMPLE_TEMPLATE_SPEC.blocks[0],
          rect: { x: 1900, y: 1000, w: 200, h: 100 }, // Extends beyond 1920x1080
        },
      ],
    };
    const res = validateTemplateSpec(invalidSpec);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('exceeds canvas boundaries'))).toBe(true);
  });

  it('rejects un-whitelisted font families', () => {
    const invalidSpec: TemplateSpec = {
      ...SAMPLE_TEMPLATE_SPEC,
      blocks: [
        {
          ...SAMPLE_TEMPLATE_SPEC.blocks[0],
          style: {
            ...SAMPLE_TEMPLATE_SPEC.blocks[0].style,
            fontFamily: 'Comic Sans MS',
          },
        },
      ],
    };
    const res = validateTemplateSpec(invalidSpec);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('not in the font whitelist'))).toBe(true);
  });

  it('rejects invalid color hex strings', () => {
    const invalidSpec: TemplateSpec = {
      ...SAMPLE_TEMPLATE_SPEC,
      blocks: [
        {
          ...SAMPLE_TEMPLATE_SPEC.blocks[0],
          style: {
            ...SAMPLE_TEMPLATE_SPEC.blocks[0].style,
            color: 'red',
          },
        },
      ],
    };
    const res = validateTemplateSpec(invalidSpec);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('#RRGGBB'))).toBe(true);
  });

  it('rejects specifications with more than 40 blocks', () => {
    const excessiveBlocks = Array.from({ length: 42 }).map((_, i) => ({
      ...SAMPLE_TEMPLATE_SPEC.blocks[0],
      id: `blk_${i}`,
    }));
    const invalidSpec: TemplateSpec = {
      ...SAMPLE_TEMPLATE_SPEC,
      blocks: excessiveBlocks,
    };
    const res = validateTemplateSpec(invalidSpec);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Maximum 40 blocks'))).toBe(true);
  });

  it('rejects invalid field keys that do not match snake_case identifier rules', () => {
    const invalidSpec: TemplateSpec = {
      ...SAMPLE_TEMPLATE_SPEC,
      fields: [
        {
          key: '123-Invalid Key!',
          label: 'Invalid',
          type: 'text',
          required: false,
          sample: '',
        },
      ],
    };
    const res = validateTemplateSpec(invalidSpec);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Invalid field key'))).toBe(true);
  });
});
