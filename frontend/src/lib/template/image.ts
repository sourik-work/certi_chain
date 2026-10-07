/**
 * @file image.ts
 * @summary Secure image loading, canvas downscaling, EXIF stripping, and PDF first-page rasterization.
 */

const MAX_LONG_SIDE = 2000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export interface ProcessedImage {
  dataUrl: string;
  mime: 'image/jpeg' | 'image/webp' | 'image/png';
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Validates file mime type and size before processing.
 */
export function validateUploadFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { valid: false, error: 'File size exceeds maximum allowed 10 MB limit.' };
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPG, PNG, WebP, and PDF files are accepted. SVG and executable formats are prohibited.',
    };
  }

  return { valid: true };
}

/**
 * Rasterizes the first page of a PDF into an HTMLCanvasElement using lazy-loaded pdfjs-dist.
 * Wrapped in try/catch to gracefully handle corrupt files, password protection, and worker issues.
 */
export async function rasterizePdfFirstPage(file: File): Promise<HTMLCanvasElement> {
  try {
    const pdfjs = await import('pdfjs-dist');
    if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '4.6.82'}/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      disableFontFace: false,
    });
    const pdf = await loadingTask.promise;
    if (pdf.numPages < 1) {
      throw new Error('The uploaded PDF does not contain any pages.');
    }
    const page = await pdf.getPage(1);

    const initialViewport = page.getViewport({ scale: 1.0 });
    const maxDim = Math.max(initialViewport.width, initialViewport.height);
    // Scale up to crisp 2x or down to max 2000px
    const scale = maxDim > 2000 ? 2000 / maxDim : Math.min(2.0, 2000 / Math.max(1, maxDim));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not obtain canvas 2D rendering context');

    // Fill white background first
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport,
      canvas,
    };
    const renderTask = (page as any).render(renderContext);
    if (renderTask && renderTask.promise) {
      await renderTask.promise;
    } else {
      await renderTask;
    }

    return canvas;
  } catch (err: unknown) {
    console.error('PDF rasterization error:', err);
    if (err instanceof Error && err.message.toLowerCase().includes('password')) {
      throw new Error('Password-protected PDFs are not supported.');
    }
    throw new Error('Failed to process PDF. Please try a different file or upload as image (PNG/JPG).');
  }
}

/**
 * Loads an image from a File or Data URL into an HTMLImageElement safely.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image: ' + String(err)));
    img.src = src;
  });
}

/**
 * Strips EXIF/metadata, downscales to max 2000px, and encodes to clean compressed JPEG/WebP.
 */
export async function processUploadImage(file: File): Promise<ProcessedImage> {
  const validation = validateUploadFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let sourceCanvas: HTMLCanvasElement | null = null;
  let naturalWidth = 0;
  let naturalHeight = 0;

  if (file.type === 'application/pdf') {
    sourceCanvas = await rasterizePdfFirstPage(file);
    naturalWidth = sourceCanvas.width;
    naturalHeight = sourceCanvas.height;
  } else {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(objectUrl);
      naturalWidth = img.naturalWidth || img.width;
      naturalHeight = img.naturalHeight || img.height;

      sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = naturalWidth;
      sourceCanvas.height = naturalHeight;
      const ctx = sourceCanvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas 2D context');
      ctx.drawImage(img, 0, 0);
    } catch (imgErr) {
      throw new Error('Failed to decode image file. Please ensure the file is not corrupted.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // Calculate target downscaled dimensions if long side > 2000
  const maxDim = Math.max(naturalWidth, naturalHeight);
  let targetWidth = naturalWidth;
  let targetHeight = naturalHeight;

  if (maxDim > MAX_LONG_SIDE) {
    const scale = MAX_LONG_SIDE / maxDim;
    targetWidth = Math.round(naturalWidth * scale);
    targetHeight = Math.round(naturalHeight * scale);
  }

  const destCanvas = document.createElement('canvas');
  destCanvas.width = targetWidth;
  destCanvas.height = targetHeight;
  const destCtx = destCanvas.getContext('2d');
  if (!destCtx) throw new Error('Failed to create canvas 2D context');

  // Fill with white first in case of transparency
  destCtx.fillStyle = '#FFFFFF';
  destCtx.fillRect(0, 0, targetWidth, targetHeight);
  destCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  // Compress to JPEG with quality 0.88
  const mime: 'image/jpeg' | 'image/webp' = 'image/jpeg';
  let quality = 0.88;
  let dataUrl = destCanvas.toDataURL(mime, quality);

  if (dataUrl.length > 1.6 * 1024 * 1024) {
    quality = 0.75;
    dataUrl = destCanvas.toDataURL(mime, quality);
  }

  return {
    dataUrl,
    mime,
    width: targetWidth,
    height: targetHeight,
    naturalWidth,
    naturalHeight,
  };
}

/**
 * Extracts raw ImageData from an HTMLCanvasElement or Image dataUrl.
 */
export async function getImagePixelData(dataUrl: string, width: number, height: number): Promise<ImageData> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Converts raw RGBA pixel data back to a data URL via a temporary canvas.
 */
export function pixelDataToDataUrl(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  mime: 'image/jpeg' | 'image/webp' | 'image/png' = 'image/jpeg',
  quality: number = 0.9
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  const imgData = ctx.createImageData(width, height);
  imgData.data.set(pixels);
  ctx.putImageData(imgData, 0, 0);

  return canvas.toDataURL(mime, quality);
}
