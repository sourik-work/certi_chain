/**
 * @file analyze.ts
 * @summary Single Entry Point for the Certificate Analysis Pipeline:
 * Vision API -> Local Web Worker OCR -> Manual Studio Setup.
 */

import { AnalysisResult, TemplateBlock, TemplateField } from './types';
import { runOcrAnalysis } from './ocr';
import { mapToWhitelistedFont } from './fonts';

export interface AnalyzeOptions {
  onProgress?: (message: string, percent: number) => void;
  pixelData?: Uint8ClampedArray;
}

export class AnalysisPipeline {
  /**
   * Attempts analysis via Vision API, falling back to local OCR, and finally Manual Mode.
   */
  public static async analyze(
    imageDataUrl: string,
    width: number,
    height: number,
    options: AnalyzeOptions = {}
  ): Promise<AnalysisResult> {
    const { onProgress, pixelData } = options;

    // Step 1: Try Serverless Vision Analyzer (/api/analyzeTemplate)
    try {
      onProgress?.('Attempting Vision AI analysis...', 10);
      const res = await fetch('/api/analyzeTemplate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl, width, height }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.blocks && Array.isArray(data.blocks)) {
          onProgress?.('Vision analysis successful!', 100);

          const formattedBlocks: TemplateBlock[] = [];
          const formattedFields: TemplateField[] = [];
          let blockCount = 1;

          for (const b of data.blocks) {
            const bbox = b.bbox || [0.1, 0.1, 0.5, 0.2];
            const x0 = Math.round(bbox[0] * width);
            const y0 = Math.round(bbox[1] * height);
            const x1 = Math.round(bbox[2] * width);
            const y1 = Math.round(bbox[3] * height);

            const blockW = Math.max(20, x1 - x0);
            const blockH = Math.max(12, y1 - y0);

            const fontSize = b.fontSizeFraction
              ? Math.round(b.fontSizeFraction * height)
              : Math.max(12, Math.round(blockH * 0.75));

            const fontFamily = mapToWhitelistedFont(b.fontFamily);

            formattedBlocks.push({
              id: `blk_vis_${blockCount++}`,
              rect: { x: x0, y: y0, w: blockW, h: blockH },
              text: b.text || '',
              role: b.role === 'variable' ? 'variable' : 'fixed',
              style: {
                fontFamily,
                fontWeight: b.fontWeight || 600,
                fontSize,
                color: b.colorHex && /^#[0-9a-fA-F]{6}$/.test(b.colorHex) ? b.colorHex : '#1E293B',
                align: b.align || 'center',
                lineHeight: 1.4,
                letterSpacing: 0.5,
                transform: 'none',
                fit: 'shrink',
                maxLines: 2,
              },
            });

            if (b.fields && Array.isArray(b.fields)) {
              for (const f of b.fields) {
                if (!formattedFields.some((exist) => exist.key === f.key)) {
                  formattedFields.push({
                    key: f.key,
                    label: f.label || f.key,
                    type: f.type || 'text',
                    required: true,
                    sample: f.sample || '',
                    options: f.options,
                    mapsTo: f.mapsTo || 'custom',
                  });
                }
              }
            }
          }

          return {
            engine: 'vision',
            canvas: { width, height },
            blocks: formattedBlocks,
            fields: formattedFields,
            suggestedName: data.suggestedName || 'Certificate Template',
          };
        }
      }
    } catch {
      console.warn('Vision AI analysis unavailable, falling back to local OCR...');
    }

    // Step 2: Fallback to local OCR Analyzer (Tesseract.js worker + heuristics)
    try {
      onProgress?.('Running local OCR text detection...', 25);
      return await runOcrAnalysis(imageDataUrl, width, height, pixelData, onProgress);
    } catch (ocrErr) {
      console.warn('OCR analysis failed, falling back to Manual Mode:', ocrErr);
    }

    // Step 3: Manual Mode fallback
    onProgress?.('Ready for manual layout in Studio', 100);
    return {
      engine: 'manual',
      canvas: { width, height },
      blocks: [],
      fields: [
        {
          key: 'recipient_name',
          label: 'Recipient Full Name',
          type: 'text',
          required: true,
          sample: 'Alice Nakamoto',
          mapsTo: 'recipient_name',
        },
      ],
      suggestedName: 'Custom Certificate',
    };
  }
}
