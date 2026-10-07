/**
 * PDF Rasterization Utility
 * Dynamically loads pdfjs-dist and renders Page 1 of uploaded PDF certificate templates
 * at high resolution (>=2.0x scale) for canvas preview and AI vision analysis.
 */

import { optimizeCanvasToDataUrl, MAX_ARTIFACT_BYTES, MAX_DIMENSION_PX } from './bytes';

export interface PdfRasterResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  numPages: number;
}

export async function rasterizePdfPageOne(
  pdfBuffer: ArrayBuffer,
  scale: number = 2.0
): Promise<PdfRasterResult> {
  // Dynamically import pdfjs-dist to keep main bundle lean
  const pdfjs = await import('pdfjs-dist');

  // Configure worker
  if (!pdfjs.GlobalWorkerOptions.workerSrc && typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '3.11.174'}/pdf.worker.min.js`;
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  if (numPages === 0) {
    throw new Error('The provided PDF document contains 0 pages.');
  }

  // Load page 1
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D rendering context is unavailable.');
  }

  // Fill white background for crisp rendering
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    canvas: canvas,
    viewport,
  };

  await page.render(renderContext as unknown as Parameters<typeof page.render>[0]).promise;

  const optimized = await optimizeCanvasToDataUrl(canvas, MAX_ARTIFACT_BYTES, MAX_DIMENSION_PX);
  const blob = new Blob([optimized.bytes.buffer as ArrayBuffer], {
    type: optimized.dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
  });

  return {
    dataUrl: optimized.dataUrl,
    blob,
    width: canvas.width,
    height: canvas.height,
    numPages,
  };
}
