import { describe, it, expect } from 'vitest';
import {
  parseFigmaUrl,
  figmaColorToHex,
  mapFigmaFontWeight,
  mapOcrVariablesToFigmaLayers,
  exportTemplateToFigmaJson,
} from './figma';
import { SAMPLE_TEMPLATE_SPEC } from './sampleSpec';

describe('Figma Integration Utilities', () => {
  describe('parseFigmaUrl', () => {
    it('parses standard Figma design URL with node-id', () => {
      const url = 'https://www.figma.com/design/AbCdEf12345/Certificate-Template?node-id=10-25&t=xyz';
      const parsed = parseFigmaUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.fileKey).toBe('AbCdEf12345');
      expect(parsed?.nodeId).toBe('10:25');
    });

    it('parses legacy Figma file URL with encoded colon node-id', () => {
      const url = 'https://www.figma.com/file/xyz789/Blockchain-Course-Certificate?node-id=1%3A2';
      const parsed = parseFigmaUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.fileKey).toBe('xyz789');
      expect(parsed?.nodeId).toBe('1:2');
    });

    it('parses Figma URL without node-id (whole file)', () => {
      const url = 'https://www.figma.com/design/MasterKey999/Certificate-Project';
      const parsed = parseFigmaUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.fileKey).toBe('MasterKey999');
      expect(parsed?.nodeId).toBeUndefined();
    });

    it('returns null for invalid or non-Figma URLs', () => {
      expect(parseFigmaUrl('https://example.com/certificate.png')).toBeNull();
      expect(parseFigmaUrl('')).toBeNull();
      expect(parseFigmaUrl('not-a-url')).toBeNull();
    });
  });

  describe('figmaColorToHex', () => {
    it('converts normalized float RGB values to #RRGGBB', () => {
      expect(figmaColorToHex({ r: 1, g: 1, b: 1 })).toBe('#FFFFFF');
      expect(figmaColorToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
      expect(figmaColorToHex({ r: 0.12, g: 0.53, b: 0.9 })).toBe('#1F87E6');
    });

    it('handles undefined color with dark fallback', () => {
      expect(figmaColorToHex(undefined)).toBe('#1E293B');
    });
  });

  describe('mapFigmaFontWeight', () => {
    it('maps numerical font weights correctly', () => {
      expect(mapFigmaFontWeight(300)).toBe(300);
      expect(mapFigmaFontWeight(400)).toBe(400);
      expect(mapFigmaFontWeight(600)).toBe(600);
      expect(mapFigmaFontWeight(700)).toBe(700);
      expect(mapFigmaFontWeight(900)).toBe(800);
    });

    it('maps textual font weights correctly', () => {
      expect(mapFigmaFontWeight('Bold')).toBe(700);
      expect(mapFigmaFontWeight('SemiBold')).toBe(600);
      expect(mapFigmaFontWeight('Medium')).toBe(600);
      expect(mapFigmaFontWeight('Light')).toBe(300);
      expect(mapFigmaFontWeight('Regular')).toBe(400);
    });
  });

  describe('mapOcrVariablesToFigmaLayers', () => {
    it('maps extracted OCR variables into matching Figma semantic layers', () => {
      const mockOcrFields = [
        {
          key: 'recipient_name',
          label: 'Recipient Full Name',
          type: 'text' as const,
          required: true,
          sample: 'Alice Nakamoto',
          mapsTo: 'recipient_name' as const,
        },
        {
          key: 'event_name',
          label: 'Event Title',
          type: 'text' as const,
          required: true,
          sample: 'Blockchain Developer Bootcamp',
          mapsTo: 'credential_title' as const,
        },
      ];

      const mockOcrBlocks = [
        {
          id: 'blk_ocr_name',
          rect: { x: 100, y: 200, w: 400, h: 50 },
          text: '{{recipient_name}}',
          style: SAMPLE_TEMPLATE_SPEC.blocks[0].style,
          role: 'variable' as const,
        },
      ];

      const mockFigmaSpec = {
        ...SAMPLE_TEMPLATE_SPEC,
        blocks: [
          {
            id: 'blk_figma_recipient_name',
            rect: { x: 120, y: 210, w: 380, h: 45 },
            text: 'Student Name Placeholder',
            style: {
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: 700 as const,
              fontSize: 32,
              color: '#0F172A',
              align: 'center' as const,
              lineHeight: 1.2,
              letterSpacing: 0,
              transform: 'none' as const,
              fit: 'shrink' as const,
              maxLines: 2,
            },
            role: 'fixed' as const,
          },
        ],
        fields: [],
      };

      const mapped = mapOcrVariablesToFigmaLayers(mockOcrFields, mockOcrBlocks, mockFigmaSpec);

      // 1. Assert Figma block was tokenized to {{recipient_name}} with Figma's typography retained
      const nameBlock = mapped.blocks.find((b) => b.text.includes('{{recipient_name}}'));
      expect(nameBlock).toBeDefined();
      expect(nameBlock?.style.fontFamily).toBe('Plus Jakarta Sans');
      expect(nameBlock?.style.fontWeight).toBe(700);
      expect(nameBlock?.role).toBe('variable');

      // 2. Assert unmatched OCR variable (event_name) is automatically appended
      const eventBlock = mapped.blocks.find((b) => b.text.includes('{{event_name}}'));
      expect(eventBlock).toBeDefined();

      // 3. Assert fields list has both OCR fields registered
      expect(mapped.fields.length).toBe(2);
      expect(mapped.fields.some((f) => f.key === 'recipient_name')).toBe(true);
      expect(mapped.fields.some((f) => f.key === 'event_name')).toBe(true);
      expect(mapped.figma?.fileKey).toBeDefined();
    });
  });

  describe('exportTemplateToFigmaJson', () => {
    it('exports a valid Figma plugin JSON schema from TemplateSpec', () => {
      const jsonStr = exportTemplateToFigmaJson(SAMPLE_TEMPLATE_SPEC);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.schemaVersion).toBe('1.0.0');
      expect(parsed.type).toBe('CERTICHAIN_TEMPLATE');
      expect(parsed.name).toBe(SAMPLE_TEMPLATE_SPEC.name);
      expect(parsed.canvas.width).toBe(SAMPLE_TEMPLATE_SPEC.canvas.width);
      expect(parsed.layers.length).toBe(SAMPLE_TEMPLATE_SPEC.blocks.length);
      expect(parsed.layers[0].type).toBe('TEXT');
    });
  });
});
