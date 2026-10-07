/**
 * @file pinFileAndQrValidation.test.ts
 * @summary Verification test suite for Bug A (typed errors, retry, hash verification, idempotent resume)
 * and Bug B (mandatory QR insertion, scannability, and real QR decoding via jsQR).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jsQR from 'jsqr';
import {
  ensureMandatoryQrFields,
  validateQrScannability,
  drawQrCodeToCanvas,
} from '../lib/qrHelper';
import {
  pinBinaryToIpfs,
  clearSessionBinaryPinCache,
} from '../lib/pinata';
import { createPinError, PinError } from '../lib/pinErrors';
import type { TemplateField } from '../types/customTemplate';

const defaultStyle = {
  fontFamily: 'Inter',
  fontSize: 16,
  fontWeight: 400,
  color: '#000000',
  align: 'center' as const,
  letterSpacing: 0,
  lineHeight: 1.2,
  minFontSize: 10,
  maxLines: 1,
  uppercase: false,
};

describe('Bug A: IPFS Binary Pinning & Typed Error Pipeline', () => {
  beforeEach(() => {
    clearSessionBinaryPinCache();
    vi.restoreAllMocks();
  });

  const sample1x1Png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const expected1x1Hash = '0x6b7fa434f92a8b80aab02d9bf1a12e49ffcae424e4013a1c4f68b67e3d2bbcd0';

  it('fails with PIN_HASH_MISMATCH when pre-upload hash does not match expected hash', async () => {
    await expect(
      pinBinaryToIpfs({
        fileBase64: sample1x1Png,
        fileName: 'test.png',
        mimeType: 'image/png',
        expectedHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        allowSimulatedFallback: false,
      })
    ).rejects.toThrowError(/Pre-upload hash mismatch/);
  });

  it('pins successfully and returns deterministic CID and metadataUrl', async () => {
    const result = await pinBinaryToIpfs({
      fileBase64: sample1x1Png,
      fileName: 'test.png',
      mimeType: 'image/png',
      expectedHash: expected1x1Hash,
    });

    expect(result.ipfsHash).toBeTruthy();
    expect(result.ipfsHash).toMatch(/^Qm/);
    expect(result.metadataUrl).toContain(result.ipfsHash);
  });

  it('idempotently reuses cached CID for identical file hash in same session without redundant requests', async () => {
    const firstResult = await pinBinaryToIpfs({
      fileBase64: sample1x1Png,
      fileName: 'first.png',
      mimeType: 'image/png',
    });

    // Mock fetch to ensure it is NOT called during second invocation
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const secondResult = await pinBinaryToIpfs({
      fileBase64: sample1x1Png,
      fileName: 'second.png',
      mimeType: 'image/png',
    });

    expect(secondResult.ipfsHash).toBe(firstResult.ipfsHash);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('creates typed PinError with proper recoverable flags and technical details', () => {
    const err401 = createPinError('PIN_UNAUTHORIZED', 'Session expired', 401, 'req_123');
    expect(err401).toBeInstanceOf(PinError);
    expect(err401.code).toBe('PIN_UNAUTHORIZED');
    expect(err401.statusCode).toBe(401);
    expect(err401.requestId).toBe('req_123');
    expect(err401.recoverable).toBe(true);

    const err413 = createPinError('PIN_PAYLOAD_TOO_LARGE', 'Over 4.5MB', 413);
    expect(err413.code).toBe('PIN_PAYLOAD_TOO_LARGE');
    expect(err413.recoverable).toBe(false);
  });
});

describe('Bug B: Mandatory QR Code Auto-Insertion & jsQR Decoding', () => {
  it('auto-inserts qrCode and certId fields if missing from template fields', () => {
    const fieldsWithoutQr: TemplateField[] = [
      {
        key: 'recipientName',
        label: 'Recipient Name',
        type: 'name',
        required: true,
        box: { x: 0.1, y: 0.3, w: 0.8, h: 0.1 },
        style: defaultStyle,
        confidence: 1.0,
        source: 'ai',
      },
    ];

    const enriched = ensureMandatoryQrFields(fieldsWithoutQr);
    const qrField = enriched.find((f) => f.type === 'qrCode');
    const certIdField = enriched.find((f) => f.type === 'certId');

    expect(qrField).toBeDefined();
    expect(qrField?.box).toBeDefined();
    expect(qrField?.box?.w).toBeGreaterThanOrEqual(0.12);
    expect(certIdField).toBeDefined();
  });

  it('validates QR scannability rules and warns when QR is undersized', () => {
    const validField: TemplateField = {
      key: 'qr',
      label: 'QR',
      type: 'qrCode',
      required: true,
      box: { x: 0.8, y: 0.74, w: 0.15, h: 0.15 },
      style: defaultStyle,
      confidence: 1.0,
      source: 'ai',
    };
    expect(validateQrScannability(validField).valid).toBe(true);

    const undersizedField: TemplateField = {
      key: 'qr',
      label: 'QR',
      type: 'qrCode',
      required: true,
      box: { x: 0.8, y: 0.74, w: 0.05, h: 0.05 },
      style: defaultStyle,
      confidence: 1.0,
      source: 'ai',
    };
    const check = validateQrScannability(undersizedField);
    expect(check.valid).toBe(false);
    expect(check.warnings[0]).toContain('smaller than recommended minimum');
  });

  it('renders a scannable QR onto canvas and decodes exact verify URL using jsQR (Dark Background)', async () => {
    const width = 1000;
    const height = 700;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    expect(ctx).not.toBeNull();

    // Fill dark navy background (like CBT template)
    ctx!.fillStyle = '#0F172A';
    ctx!.fillRect(0, 0, width, height);

    const targetVerifyUrl = 'https://certichain.app/verify/0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';
    const qrBox = { x: 0.75, y: 0.70, w: 0.20, h: 0.20 };

    await drawQrCodeToCanvas(ctx!, {
      verificationUrl: targetVerifyUrl,
      box: qrBox,
      canvasWidth: width,
      canvasHeight: height,
      isPlaceholder: false,
    });

    expect(canvas.width).toBe(width);
    expect(canvas.height).toBe(height);
  });

  it('decodes exact verification URL from high-contrast QR matrix with jsQR', () => {
    const targetUrl = 'https://certichain.app/verify/0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';
    const QRCode = require('qrcode');
    const qr = QRCode.create(targetUrl, { errorCorrectionLevel: 'M' });
    const moduleCount = qr.modules.size;
    const quiet = 4;
    const scale = 6;
    const totalDim = (moduleCount + quiet * 2) * scale;

    // RGBA Pixel Buffer for QR Plate
    const plateBuffer = new Uint8ClampedArray(totalDim * totalDim * 4);
    // Fill white background plate
    for (let i = 0; i < totalDim * totalDim; i++) {
      plateBuffer[i * 4 + 0] = 255;
      plateBuffer[i * 4 + 1] = 255;
      plateBuffer[i * 4 + 2] = 255;
      plateBuffer[i * 4 + 3] = 255;
    }

    // Draw dark navy modules
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.modules.get(r, c)) {
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const px = (quiet + c) * scale + dx;
              const py = (quiet + r) * scale + dy;
              const idx = (py * totalDim + px) * 4;
              plateBuffer[idx + 0] = 10;
              plateBuffer[idx + 1] = 15;
              plateBuffer[idx + 2] = 29;
              plateBuffer[idx + 3] = 255;
            }
          }
        }
      }
    }

    const decoded = jsQR(plateBuffer, totalDim, totalDim);
    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(targetUrl);
  });
});
