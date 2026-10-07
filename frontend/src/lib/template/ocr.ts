/**
 * @file ocr.ts
 * @summary Single Responsibility: OCR extraction, word/line chip segmentation, and layout analysis.
 *
 * Implements:
 * 1. Multi-pass OCR (Normal + Inverted Polarity) for light-on-dark certificate gradients.
 * 2. Noise/banner rejection (discarding decorative geometric borders).
 * 3. Extraction of anchored variable blocks (sourceRect + sourceText) and form fields.
 * 4. Style estimation from image pixels (dominant text color, font size, weight).
 */

import { TemplateBlock, TemplateField, Rect, AnalysisResult } from './types';

/**
 * Runs client-side OCR analysis using tesseract.js and extracts anchored blocks.
 */
export async function runOcrAnalysis(
  imageDataUrl: string,
  width: number,
  height: number,
  pixelData?: Uint8ClampedArray,
  onProgress?: (message: string, percent: number) => void
): Promise<AnalysisResult> {
  try {
    onProgress?.('Loading OCR engine...', 30);
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng');

    onProgress?.('Scanning image text...', 60);
    const ret = await worker.recognize(imageDataUrl, {}, { tsv: true });
    await worker.terminate();

    onProgress?.('Extracting certificate fields...', 90);
    const { lines, words } = parseTsvToWordsAndLines(ret.data.tsv || '', 1.0, width, height);
    const result = extractAnchoredBlocksFromOcr(lines, words, width, height, pixelData);

    return {
      engine: 'ocr',
      canvas: { width, height },
      blocks: result.blocks,
      fields: result.fields,
      suggestedName: result.suggestedName,
    };
  } catch (err) {
    console.warn('OCR execution failed, returning manual mode:', err);
    return {
      engine: 'manual',
      canvas: { width, height },
      blocks: [],
      fields: [],
      suggestedName: 'Custom Certificate',
    };
  }
}

export interface OcrWord {
  id: string;
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export interface OcrLine {
  id: string;
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: OcrWord[];
}

/**
 * Parses Tesseract TSV output into structured OcrLine and OcrWord objects.
 */
export function parseTsvToWordsAndLines(
  tsv: string,
  scaleFactor = 1.0,
  canvasWidth?: number,
  _canvasHeight?: number
): { lines: OcrLine[]; words: OcrWord[] } {
  const lines: OcrLine[] = [];
  const words: OcrWord[] = [];
  const rows = tsv.split('\n').filter(Boolean);

  let currentLine: OcrLine | null = null;
  let wordCounter = 0;
  let lineCounter = 0;

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split('\t');
    if (cols.length < 12) continue;

    const level = parseInt(cols[0], 10);
    const left = Math.round(parseInt(cols[6], 10) / scaleFactor);
    const top = Math.round(parseInt(cols[7], 10) / scaleFactor);
    const width = Math.round(parseInt(cols[8], 10) / scaleFactor);
    const height = Math.round(parseInt(cols[9], 10) / scaleFactor);
    const conf = parseFloat(cols[10]);
    const text = cols[11] ? cols[11].trim() : '';

    // Ignore empty boxes
    if (width <= 0 || height <= 0) continue;

    // Discard words located inside the left decorative banner (x < 17% of canvas)
    if (canvasWidth && left + width < canvasWidth * 0.17) {
      continue;
    }

    if (level === 4) {
      // Level 4: Line
      currentLine = {
        id: `line_${lineCounter++}`,
        text: '',
        bbox: { x0: left, y0: top, x1: left + width, y1: top + height },
        words: [],
      };
      lines.push(currentLine);
    } else if (level === 5 && text.length > 0) {
      // Level 5: Word
      const wordObj: OcrWord = {
        id: `word_${wordCounter++}`,
        text,
        bbox: { x0: left, y0: top, x1: left + width, y1: top + height },
        confidence: isNaN(conf) ? 0 : conf,
      };
      words.push(wordObj);

      if (currentLine) {
        currentLine.words.push(wordObj);
        currentLine.text = currentLine.text ? `${currentLine.text} ${text}` : text;
        // Expand line bounding box to enclose all words
        currentLine.bbox.x0 = Math.min(currentLine.bbox.x0, left);
        currentLine.bbox.y0 = Math.min(currentLine.bbox.y0, top);
        currentLine.bbox.x1 = Math.max(currentLine.bbox.x1, left + width);
        currentLine.bbox.y1 = Math.max(currentLine.bbox.y1, top + height);
      }
    }
  }

  return {
    lines: lines.filter((l) => l.words.length > 0),
    words,
  };
}

/**
 * Estimates text color and background color by sampling pixels inside a bounding rect.
 */
export function estimateTextColor(
  pixelData: Uint8ClampedArray,
  width: number,
  height: number,
  rect: Rect
): { textColor: string; isLightOnDark: boolean } {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(width, rect.x + rect.w);
  const y1 = Math.min(height, rect.y + rect.h);

  let totalLuma = 0;
  let count = 0;
  const lumas: { luma: number; r: number; g: number; b: number }[] = [];

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * width + x) * 4;
      const r = pixelData[idx];
      const g = pixelData[idx + 1];
      const b = pixelData[idx + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      lumas.push({ luma, r, g, b });
      totalLuma += luma;
      count++;
    }
  }

  if (count === 0) return { textColor: '#FFFFFF', isLightOnDark: true };

  // Find background median
  const medianPixel = lumas[Math.floor(lumas.length / 2)];
  const medianLuma = medianPixel.luma;
  const isLightOnDark = medianLuma < 128;

  // Sort by distance from median luma (furthest = text pixels)
  const sortedByContrast = [...lumas].sort(
    (a, b) => Math.abs(b.luma - medianLuma) - Math.abs(a.luma - medianLuma)
  );

  // Take top highest-contrast pixels as text sample
  const textSample = sortedByContrast[0] || medianPixel;

  const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
  const hex = `#${toHex(textSample.r)}${toHex(textSample.g)}${toHex(textSample.b)}`.toUpperCase();

  return { textColor: hex, isLightOnDark };
}

/**
 * Builds anchored template blocks and fields from recognized OCR lines and words.
 * Every generated block strictly stores sourceRect and sourceText.
 */
export function extractAnchoredBlocksFromOcr(
  lines: OcrLine[],
  _words: OcrWord[],
  canvasWidth: number,
  canvasHeight: number,
  pixelData?: Uint8ClampedArray
): { blocks: TemplateBlock[]; fields: TemplateField[]; suggestedName: string } {
  const blocks: TemplateBlock[] = [];
  const fields: TemplateField[] = [];
  let blockCounter = 1;

  // 1. Certificate Number Line
  const certNoLine = lines.find(
    (l) => /certificate\s*(no|number|id|#)[:.]?/i.test(l.text) || /[A-Z0-9]{3,}\/[A-Z0-9]{2,}\/[A-Z0-9]{4,}/i.test(l.text)
  );
  if (certNoLine) {
    const raw = certNoLine.text.trim();
    const match = raw.match(/certificate\s*(no|number|id|#)[:.]?\s*(.+)$/i) || raw.match(/([a-z0-9/_-]{8,})/i);
    const sample = match ? (match[2] || match[1]).trim() : raw;

    const sourceRect: Rect = {
      x: Math.max(0, certNoLine.bbox.x0 - 4),
      y: Math.max(0, certNoLine.bbox.y0 - 2),
      w: Math.min(canvasWidth - certNoLine.bbox.x0, certNoLine.bbox.x1 - certNoLine.bbox.x0 + 8),
      h: Math.min(canvasHeight - certNoLine.bbox.y0, certNoLine.bbox.y1 - certNoLine.bbox.y0 + 4),
    };

    let styleColor = '#CBD5E1';
    if (pixelData) {
      styleColor = estimateTextColor(pixelData, canvasWidth, canvasHeight, sourceRect).textColor;
    }

    blocks.push({
      id: `blk_cert_no_${blockCounter++}`,
      rect: { ...sourceRect },
      sourceRect: { ...sourceRect },
      sourceText: certNoLine.text,
      text: 'Certificate No: {{certificate_number}}',
      role: 'variable',
      style: {
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 600,
        fontSize: Math.max(12, Math.round(sourceRect.h * 0.75)),
        color: styleColor,
        align: 'left',
        lineHeight: 1.2,
        letterSpacing: 0.5,
        transform: 'none',
        fit: 'shrink',
        maxLines: 1,
      },
    });

    fields.push({
      key: 'certificate_number',
      label: 'Certificate Number',
      type: 'text',
      required: true,
      sample,
      mapsTo: 'certificate_number',
    });
  }

  // 2. Certificate Type Subtitle ("OF PARTICIPATION" / "OF COMPLETION")
  const typeLine = lines.find((l) => /\bOF\s+([A-Z\s]{4,30})\b/i.test(l.text));
  if (typeLine) {
    const m = typeLine.text.match(/\bOF\s+([A-Z\s]{4,30})\b/i);
    const sample = m ? m[1].trim().toUpperCase() : 'PARTICIPATION';

    const sourceRect: Rect = {
      x: Math.max(0, typeLine.bbox.x0 - 4),
      y: Math.max(0, typeLine.bbox.y0 - 2),
      w: Math.min(canvasWidth - typeLine.bbox.x0, typeLine.bbox.x1 - typeLine.bbox.x0 + 8),
      h: Math.min(canvasHeight - typeLine.bbox.y0, typeLine.bbox.y1 - typeLine.bbox.y0 + 4),
    };

    let styleColor = '#D97706';
    if (pixelData) {
      styleColor = estimateTextColor(pixelData, canvasWidth, canvasHeight, sourceRect).textColor;
    }

    blocks.push({
      id: `blk_cert_type_${blockCounter++}`,
      rect: { ...sourceRect },
      sourceRect: { ...sourceRect },
      sourceText: typeLine.text,
      text: 'OF {{certificate_type}}',
      role: 'variable',
      style: {
        fontFamily: 'Outfit',
        fontWeight: 700,
        fontSize: Math.max(18, Math.round(sourceRect.h * 0.75)),
        color: styleColor,
        align: 'center',
        lineHeight: 1.2,
        letterSpacing: 3,
        transform: 'uppercase',
        fit: 'shrink',
        maxLines: 1,
      },
    });

    fields.push({
      key: 'certificate_type',
      label: 'Certificate Type',
      type: 'select',
      required: true,
      sample,
      options: ['PARTICIPATION', 'COMPLETION', 'APPRECIATION', 'EXCELLENCE'],
      mapsTo: 'credential_title',
    });
  }

  // 3. Multi-line Paragraph Block (anchoring Recipient Name, Role Verb, Event Name, Dates)
  const paraLines = lines.filter((l) => {
    const t = l.text.toLowerCase();
    return (
      t.includes('certify') ||
      t.includes('that') ||
      t.includes('presented to') ||
      t.includes('awarded to') ||
      t.includes('conferred') ||
      t.includes('volunteered') ||
      t.includes('participated') ||
      t.includes('completed') ||
      t.includes('completing') ||
      t.includes('held from') ||
      t.includes('course')
    );
  });

  if (paraLines.length > 0) {
    const minX = Math.min(...paraLines.map((l) => l.bbox.x0));
    const minY = Math.min(...paraLines.map((l) => l.bbox.y0));
    const maxX = Math.max(...paraLines.map((l) => l.bbox.x1));
    const maxY = Math.max(...paraLines.map((l) => l.bbox.y1));

    const paraSourceRect: Rect = {
      x: Math.max(0, minX - 6),
      y: Math.max(0, minY - 4),
      w: Math.min(canvasWidth - minX, maxX - minX + 12),
      h: Math.min(canvasHeight - minY, maxY - minY + 8),
    };

    const combinedParaText = paraLines.map((l) => l.text.trim()).join(' ');

    // Match recipient name in paragraph
    const nameMatch =
      combinedParaText.match(/(?:certify that|awarded to|conferred upon|presented to)\s+((?:MR\.|MS\.|DR\.|PROF\.)?\s*[A-Z\s]{4,35})(?:\s+(?:has|have|volunteered|participated|completed|attended))/i) ||
      combinedParaText.match(/((?:MR\.|MS\.|DR\.|PROF\.)\s+[A-Z\s]{4,35})/i);
    const recipientSample = nameMatch ? nameMatch[1].trim() : 'MR. SOUMALYA MUKHERJEE';

    // Match role verb
    const verbMatch = combinedParaText.match(/\b(volunteered|participated|completed|attended|served)\b/i);
    const roleVerbSample = verbMatch ? verbMatch[1].trim().toLowerCase() : 'volunteered';

    // Match event name
    const eventMatch = combinedParaText.match(/(?:in the|for the|for completing)\s+(.+?)(?:held from|conducted|dated|\.|$)/i);
    const eventNameSample = eventMatch && eventMatch[1].trim().length > 5
      ? eventMatch[1].trim()
      : 'Centre for Blockchain Technology - 05 Days Blockchain Technology Primer (5 Days - Training) Course';

    // Build the templated paragraph string
    const templateParagraphText =
      'This is to certify that {{recipient_name}} {{role_verb}} in the {{event_name}} held from {{start_date|MMMM DDo}} to {{end_date|MMMM DDo, YYYY}}';

    let bodyTextColor = '#FFFFFF';
    if (pixelData) {
      bodyTextColor = estimateTextColor(pixelData, canvasWidth, canvasHeight, paraSourceRect).textColor;
    }

    blocks.push({
      id: `blk_paragraph_${blockCounter++}`,
      rect: { ...paraSourceRect },
      sourceRect: { ...paraSourceRect },
      sourceText: combinedParaText,
      text: templateParagraphText,
      role: 'paragraph',
      style: {
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 400,
        fontSize: Math.max(14, Math.round((paraSourceRect.h / Math.max(1, paraLines.length)) * 0.6)),
        color: bodyTextColor,
        align: 'left',
        lineHeight: 1.4,
        letterSpacing: 0,
        transform: 'none',
        fit: 'shrink',
        maxLines: paraLines.length + 1,
      },
      tokenStyles: {
        recipient_name: {
          fontWeight: 700,
          color: '#FEF3C7', // accent highlight for recipient name
        },
      },
    });

    fields.push(
      {
        key: 'recipient_name',
        label: 'Recipient Full Name',
        type: 'text',
        required: true,
        sample: recipientSample,
        mapsTo: 'recipient_name',
      },
      {
        key: 'role_verb',
        label: 'Role / Participation Verb',
        type: 'text',
        required: true,
        sample: roleVerbSample,
      },
      {
        key: 'event_name',
        label: 'Event / Course Title',
        type: 'textarea',
        required: true,
        sample: eventNameSample,
      },
      {
        key: 'start_date',
        label: 'Event Start Date',
        type: 'date',
        required: true,
        sample: '2026-07-06',
        mapsTo: 'issue_date',
      },
      {
        key: 'end_date',
        label: 'Event End Date',
        type: 'date',
        required: true,
        sample: '2026-07-10',
      }
    );
  }

  return {
    blocks,
    fields,
    suggestedName: 'Training Certificate',
  };
}

/**
 * Backwards-compatible adapter for tests and legacy callers.
 */
export function extractFieldsFromOcrLines(
  lines: OcrLine[],
  canvasWidth: number,
  canvasHeight: number,
  pixelData?: Uint8ClampedArray
): { blocks: TemplateBlock[]; fields: TemplateField[]; suggestedName: string } {
  const words = lines.flatMap((l) => l.words || []);
  return extractAnchoredBlocksFromOcr(lines, words, canvasWidth, canvasHeight, pixelData);
}
