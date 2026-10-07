/**
 * OCR Line Extraction Service
 * Lazy-loads Tesseract.js (or browser OCR pipeline) to detect exact line bounding boxes,
 * text snippets, and confidence scores from uploaded certificate templates.
 */

import type { NormalizedBox } from '../types/customTemplate';
import { snapBox } from './templateAnalysis';

export interface OcrLine {
  id: string; // e.g. "line_0", "line_1"
  text: string;
  box: NormalizedBox;
  confidence: number; // 0..1
}

export interface OcrExtractionResult {
  lines: OcrLine[];
  widthPx: number;
  heightPx: number;
}

/**
 * Extracts line-level bounding boxes from an image Blob/File using Tesseract.js OCR.
 */
export async function extractOcrLines(
  imageSource: Blob | File | string,
  imageWidth: number,
  imageHeight: number
): Promise<OcrExtractionResult> {
  try {
    const Tesseract = (await import('tesseract.js')).default;
    const worker = await Tesseract.createWorker('eng');
    const ret = await worker.recognize(imageSource, {}, { tsv: true });
    await worker.terminate();

    const tsv = ret.data.tsv || '';
    const tsvRows = tsv.trim().split('\n');
    if (tsvRows.length <= 1) {
      return { lines: [], widthPx: imageWidth, heightPx: imageHeight };
    }

    const header = tsvRows[0].split('\t');
    const levelIdx = header.indexOf('level');
    const leftIdx = header.indexOf('left');
    const topIdx = header.indexOf('top');
    const widthIdx = header.indexOf('width');
    const heightIdx = header.indexOf('height');
    const confIdx = header.indexOf('conf');
    const textIdx = header.indexOf('text');

    const lines: OcrLine[] = [];
    let currentLineWords: string[] = [];
    let currentLineBox: { left: number; top: number; right: number; bottom: number } | null = null;
    let currentLineConfs: number[] = [];

    const flushCurrentLine = () => {
      if (currentLineWords.length > 0 && currentLineBox) {
        const fullText = currentLineWords.join(' ').trim();
        if (fullText.length > 0) {
          const rawBox: NormalizedBox = {
            x: currentLineBox.left / imageWidth,
            y: currentLineBox.top / imageHeight,
            w: (currentLineBox.right - currentLineBox.left) / imageWidth,
            h: (currentLineBox.bottom - currentLineBox.top) / imageHeight,
          };

          const avgConf =
            currentLineConfs.length > 0
              ? currentLineConfs.reduce((a, b) => a + b, 0) / currentLineConfs.length / 100
              : 0.85;

          const snapped = snapBox(rawBox);
          if (snapped) {
            lines.push({
              id: `line_${lines.length}`,
              text: fullText,
              box: snapped,
              confidence: Math.max(0.1, Math.min(1.0, avgConf)),
            });
          }
        }
      }
      currentLineWords = [];
      currentLineBox = null;
      currentLineConfs = [];
    };

    for (let i = 1; i < tsvRows.length; i++) {
      const cols = tsvRows[i].split('\t');
      const level = parseInt(cols[levelIdx], 10);
      const left = parseInt(cols[leftIdx], 10);
      const top = parseInt(cols[topIdx], 10);
      const width = parseInt(cols[widthIdx], 10);
      const height = parseInt(cols[heightIdx], 10);
      const conf = parseFloat(cols[confIdx]);
      const text = cols[textIdx] || '';

      if (level === 4) {
        // Line level in TSV
        flushCurrentLine();
      } else if (level === 5 && text.trim().length > 0) {
        // Word level in TSV
        currentLineWords.push(text.trim());
        if (!currentLineBox) {
          currentLineBox = { left, top, right: left + width, bottom: top + height };
        } else {
          currentLineBox.left = Math.min(currentLineBox.left, left);
          currentLineBox.top = Math.min(currentLineBox.top, top);
          currentLineBox.right = Math.max(currentLineBox.right, left + width);
          currentLineBox.bottom = Math.max(currentLineBox.bottom, top + height);
        }
        if (!isNaN(conf) && conf >= 0) {
          currentLineConfs.push(conf);
        }
      }
    }
    flushCurrentLine();

    return { lines, widthPx: imageWidth, heightPx: imageHeight };
  } catch (err) {
    console.warn('[ocrService] Tesseract line extraction fallback:', err);
    return { lines: [], widthPx: imageWidth, heightPx: imageHeight };
  }
}
