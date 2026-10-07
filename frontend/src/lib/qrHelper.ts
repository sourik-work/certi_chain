/**
 * @file qrHelper.ts
 * @summary Single source of truth for QR code placement, auto-insertion, scannability validation,
 * and deterministic canvas rendering for Custom Certificates.
 */

import QRCode from 'qrcode';
import type { TemplateField, NormalizedBox } from '../types/customTemplate';

export const MIN_QR_SIZE_RATIO = 0.08; // Min 8% of shorter template dimension
export const MIN_QR_PX_AT_1920 = 120; // Min 120px at 1920px canvas

/**
 * Finds the optimal default bounding box for the QR code slot.
 * Prefers bottom-right safe zone, fallback bottom-left, or deterministic bottom corner.
 */
export function calculateDefaultQrBox(
  safeZones?: NormalizedBox[]
): NormalizedBox {
  // Sleek compact bottom-right placement
  const defaultBR: NormalizedBox = { x: 0.82, y: 0.76, w: 0.12, h: 0.16 };

  if (!safeZones || safeZones.length === 0) {
    return defaultBR;
  }

  // Find safe zone in the bottom quadrant
  const bottomZones = safeZones.filter((z) => z.y >= 0.5);
  if (bottomZones.length > 0) {
    // Sort by rightmost first
    bottomZones.sort((a, b) => (b.x + b.w) - (a.x + a.w));
    const best = bottomZones[0];
    const sizeW = Math.min(best.w, 0.15);
    const sizeH = Math.min(best.h, 0.19);
    return {
      x: Math.max(0.02, best.x + best.w - sizeW - 0.02),
      y: Math.max(0.02, best.y + best.h - sizeH - 0.02),
      w: Math.max(MIN_QR_SIZE_RATIO, sizeW),
      h: Math.max(MIN_QR_SIZE_RATIO, sizeH),
    };
  }

  return defaultBR;
}

/**
 * Ensures template fields contain mandatory qrCode, certId, and proofHash fields.
 */
export function ensureMandatoryQrFields(
  fields: TemplateField[],
  safeZones?: NormalizedBox[]
): TemplateField[] {
  const result = [...fields];

  // 1. Ensure qrCode field
  const existingQr = result.find((f) => f.type === 'qrCode');
  const qrBox = existingQr?.box || calculateDefaultQrBox(safeZones);

  if (!existingQr) {
    result.push({
      key: 'verificationQr',
      label: 'Verification QR Code',
      type: 'qrCode',
      required: true,
      box: qrBox,
      style: {
        fontFamily: 'Courier New',
        fontSize: 10,
        fontWeight: 400,
        color: '#000000',
        align: 'center',
        letterSpacing: 0,
        lineHeight: 1,
        minFontSize: 8,
        maxLines: 1,
        uppercase: false,
      },
      sampleText: 'VERIFY-QR',
      confidence: 1.0,
      source: 'ai',
    });
  }

  // 2. Ensure certId field
  const existingCertId = result.find((f) => f.type === 'certId');
  if (!existingCertId) {
    result.push({
      key: 'certIdText',
      label: 'Certificate Identifier',
      type: 'certId',
      required: false,
      box: {
        x: qrBox.x,
        y: Math.min(0.96, qrBox.y + qrBox.h + 0.01),
        w: qrBox.w,
        h: 0.03,
      },
      style: {
        fontFamily: 'Courier New',
        fontSize: 10,
        fontWeight: 600,
        color: '#475569',
        align: 'center',
        letterSpacing: 0,
        lineHeight: 1.1,
        minFontSize: 8,
        maxLines: 1,
        uppercase: false,
      },
      sampleText: '0x0000...0000',
      confidence: 1.0,
      source: 'ai',
    });
  }

  return result;
}

/**
 * Validates scannability rules for the QR code field.
 */
export function validateQrScannability(qrField?: TemplateField): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (!qrField || !qrField.box) {
    return { valid: false, warnings: ['Mandatory Verification QR code field is missing from template.'] };
  }

  const { w, h } = qrField.box;
  if (w < MIN_QR_SIZE_RATIO || h < MIN_QR_SIZE_RATIO) {
    warnings.push(`QR code dimension (${(Math.min(w, h) * 100).toFixed(1)}%) is smaller than recommended minimum (${MIN_QR_SIZE_RATIO * 100}%).`);
  }

  // Ensure aspect ratio is reasonably square
  const aspectRatio = w / h;
  if (aspectRatio < 0.75 || aspectRatio > 1.35) {
    warnings.push(`QR code bounding box is not square (aspect ratio ${aspectRatio.toFixed(2)}). May cause scanner distortion.`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Draws the high-contrast scannable QR Code tile directly onto the target 2D canvas context.
 */
export async function drawQrCodeToCanvas(
  ctx: CanvasRenderingContext2D,
  options: {
    verificationUrl: string;
    box: NormalizedBox;
    canvasWidth: number;
    canvasHeight: number;
    isPlaceholder?: boolean;
  }
): Promise<void> {
  const { verificationUrl, box, canvasWidth, canvasHeight, isPlaceholder } = options;

  const targetX = Math.round(box.x * canvasWidth);
  const targetY = Math.round(box.y * canvasHeight);
  const targetW = Math.round(box.w * canvasWidth);
  const targetH = Math.round(box.h * canvasHeight);
  const qrDimension = Math.min(targetW, targetH);

  // 1. Draw solid light background plate with subtle rounded corners
  const pad = Math.round(qrDimension * 0.05);
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 2;

  // Plate rectangle
  ctx.fillRect(targetX, targetY, targetW, targetH);
  ctx.strokeRect(targetX, targetY, targetW, targetH);

  // 2. Generate and render QR matrix directly (synchronous & sharp)
  try {
    const qr = QRCode.create(verificationUrl, {
      errorCorrectionLevel: 'M',
    });

    const moduleCount = qr.modules.size;
    const quietModules = 2;
    const totalModules = moduleCount + quietModules * 2;
    const moduleSize = (qrDimension - pad * 2) / totalModules;
    const innerX = targetX + (targetW - (qrDimension - pad * 2)) / 2 + quietModules * moduleSize;
    const innerY = targetY + (targetH - (qrDimension - pad * 2)) / 2 + quietModules * moduleSize;

    ctx.fillStyle = '#0A0F1D'; // Deep dark navy modules
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.modules.get(row, col)) {
          ctx.fillRect(
            Math.floor(innerX + col * moduleSize),
            Math.floor(innerY + row * moduleSize),
            Math.ceil(moduleSize),
            Math.ceil(moduleSize)
          );
        }
      }
    }

    if (isPlaceholder) {
      // Draw watermark label for preview
      ctx.fillStyle = 'rgba(234, 88, 12, 0.9)'; // Amber
      ctx.fillRect(targetX, targetY + targetH - 18, targetW, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PREVIEW QR', targetX + targetW / 2, targetY + targetH - 9);
    }
  } catch (err) {
    console.warn('[qrHelper] Failed to draw QR code to canvas:', err);
    ctx.fillStyle = '#1E293B';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VERIFY QR', targetX + targetW / 2, targetY + targetH / 2);
  } finally {
    ctx.restore();
  }
}
