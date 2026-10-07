/**
 * EXIF & GPS Metadata Stripping Utility
 * Strips EXIF, GPS, camera metadata, and device profiles from raster images (JPEG/PNG/WEBP)
 * before pinning to IPFS to protect recipient & issuer privacy.
 */

import { optimizeCanvasToDataUrl, MAX_ARTIFACT_BYTES } from './bytes';

/**
 * Strips JPEG EXIF segments (APP1 0xFFE1) directly at the byte level.
 */
export function stripJpegExifBytes(buffer: ArrayBuffer): Uint8Array {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Check JPEG SOI (Start of Image) marker: 0xFFD8
  if (view.getUint16(0) !== 0xffd8) {
    return bytes;
  }

  const chunks: Uint8Array[] = [];
  chunks.push(bytes.subarray(0, 2)); // Keep SOI

  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      // Not a valid marker, copy remainder
      chunks.push(bytes.subarray(offset));
      break;
    }

    const marker = bytes[offset + 1];

    // SOS (Start of Scan) or EOI (End of Image) -> remaining is image stream
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(bytes.subarray(offset));
      break;
    }

    const length = view.getUint16(offset + 2);

    // APP1 (0xE1) contains EXIF and GPS data; APP2 (0xE2) can contain ICC / FlashPix
    if (marker === 0xe1 || marker === 0xe2) {
      // Skip this EXIF/GPS marker segment
      offset += 2 + length;
    } else {
      // Keep other valid markers (SOF, DHT, DQT, DRI, APP0 JFIF)
      chunks.push(bytes.subarray(offset, offset + 2 + length));
      offset += 2 + length;
    }
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return result;
}

/**
 * Strips metadata by re-encoding through an in-memory Canvas or direct byte stripping.
 */
export async function stripExifFromImage(
  blob: Blob
): Promise<{ cleanBlob: Blob; cleanDataUrl: string }> {
  const mimeType = blob.type;

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    const arrayBuffer = await blob.arrayBuffer();
    const strippedBytes = stripJpegExifBytes(arrayBuffer);
    if (strippedBytes.length <= MAX_ARTIFACT_BYTES) {
      const cleanBlob = new Blob([strippedBytes.buffer as ArrayBuffer], { type: 'image/jpeg' });
      const cleanDataUrl = await blobToDataUrl(cleanBlob);
      return { cleanBlob, cleanDataUrl };
    }
  }

  // Re-encode through 2D canvas with budget-aware compression
  if (typeof document !== 'undefined') {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(blob);

    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to decode image for metadata stripping.'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');

      ctx.drawImage(img, 0, 0);

      const optimized = await optimizeCanvasToDataUrl(canvas);
      const cleanBlob = new Blob([optimized.bytes.buffer as ArrayBuffer], {
        type: optimized.dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
      });

      return { cleanBlob, cleanDataUrl: optimized.dataUrl };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const cleanDataUrl = await blobToDataUrl(blob);
  return { cleanBlob: blob, cleanDataUrl };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
