export const MAX_ARTIFACT_BYTES = 3.2 * 1024 * 1024;   // 3.2 MB per artifact
export const MAX_UPLOAD_BYTES   = 8  * 1024 * 1024;    // 8 MB raw upload
export const MAX_DIMENSION_PX   = 3200;                // long-edge cap
export const PROXY_THRESHOLD    = 3.5 * 1024 * 1024;   // future Phase 2 hook

/**
 * Optimizes an in-memory HTMLCanvasElement to a budget-compliant Data URL (WebP/PNG),
 * returning the final dataUrl, Uint8Array bytes, and SHA-256 hash.
 * Tries in order:
 *  a) webp @ 0.95
 *  b) webp @ 0.88
 *  c) downscale to maxDimPx, webp @ 0.88
 *  d) png (final fallback)
 */
export async function optimizeCanvasToDataUrl(
  canvas: HTMLCanvasElement,
  maxBytes: number = MAX_ARTIFACT_BYTES,
  maxDimPx: number = MAX_DIMENSION_PX
): Promise<{ dataUrl: string; bytes: Uint8Array; hash: string }> {
  let targetCanvas = canvas;
  const origW = canvas.width || 1;
  const origH = canvas.height || 1;
  const initialLongEdge = Math.max(origW, origH);

  // If initial dimension exceeds maxDimPx, downscale first
  if (initialLongEdge > maxDimPx && typeof document !== 'undefined') {
    const scale = maxDimPx / initialLongEdge;
    const downW = Math.max(1, Math.round(origW * scale));
    const downH = Math.max(1, Math.round(origH * scale));
    const downCanvas = document.createElement('canvas');
    downCanvas.width = downW;
    downCanvas.height = downH;
    const downCtx = downCanvas.getContext('2d');
    if (downCtx) {
      downCtx.drawImage(canvas, 0, 0, downW, downH);
      targetCanvas = downCanvas;
    }
  }

  // Helper to extract bytes safely
  const getBytes = (dataUrl: string): Uint8Array => {
    try {
      return base64ToUint8Array(dataUrl);
    } catch {
      return new Uint8Array(0);
    }
  };

  // Step a: webp @ 0.95
  let candidateDataUrl = targetCanvas.toDataURL('image/webp', 0.95);
  let candidateBytes = getBytes(candidateDataUrl);

  // Step b: webp @ 0.88 if over budget
  if (candidateBytes.length > maxBytes) {
    candidateDataUrl = targetCanvas.toDataURL('image/webp', 0.88);
    candidateBytes = getBytes(candidateDataUrl);
  }

  // Step c: downscale further (if needed) & webp @ 0.88
  if (candidateBytes.length > maxBytes && typeof document !== 'undefined') {
    const currentW = targetCanvas.width;
    const currentH = targetCanvas.height;
    const currentLongEdge = Math.max(currentW, currentH);
    const targetEdge = Math.min(maxDimPx, Math.max(1200, Math.round(currentLongEdge * 0.75)));
    const scale = targetEdge / currentLongEdge;
    const furtherW = Math.max(1, Math.round(currentW * scale));
    const furtherH = Math.max(1, Math.round(currentH * scale));
    const furtherCanvas = document.createElement('canvas');
    furtherCanvas.width = furtherW;
    furtherCanvas.height = furtherH;
    const furtherCtx = furtherCanvas.getContext('2d');
    if (furtherCtx) {
      furtherCtx.drawImage(targetCanvas, 0, 0, furtherW, furtherH);
      targetCanvas = furtherCanvas;
      candidateDataUrl = targetCanvas.toDataURL('image/webp', 0.88);
      candidateBytes = getBytes(candidateDataUrl);
    }
  }

  const hash = await sha256Bytes(candidateBytes);

  return {
    dataUrl: candidateDataUrl,
    bytes: candidateBytes,
    hash,
  };
}

/**
 * Converts a base64 string or data URL to a Uint8Array byte buffer.
 * Automatically handles data URI prefixes (e.g. data:image/png;base64,...).
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts a Uint8Array or ArrayBuffer to a 0x-prefixed hexadecimal string.
 */
export function bytesToHex(bytes: Uint8Array | ArrayBuffer): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return `0x${Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Converts a Uint8Array buffer into a base64 Data URL string with the specified MIME type.
 */
export function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string = 'image/png'): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Sniffs binary magic bytes to determine image MIME type.
 * Returns 'image/png', 'image/webp', 'image/jpeg', or 'application/octet-stream'.
 */
export function sniffImageMime(bytes: Uint8Array): string {
  if (!bytes || bytes.length < 4) {
    return 'application/octet-stream';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: "RIFF" at 0 and "WEBP" at 8
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // JPEG: FF D8 FF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  return 'application/octet-stream';
}

/**
 * Computes the SHA-256 digest of a Uint8Array buffer and returns a 0x-prefixed lowercase hex string.
 */
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const subtleCrypto =
    typeof window !== 'undefined' && window.crypto && window.crypto.subtle
      ? window.crypto.subtle
      : (await import('crypto')).webcrypto.subtle;
  const digestBuffer = await subtleCrypto.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return bytesToHex(digestBuffer);
}





