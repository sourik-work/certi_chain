/**
 * @file export.ts
 * @summary High-Resolution Certificate Visual Exporter (PNG & Landscape A4 PDF).
 *
 * Privacy & Security Guarantees:
 * - 100% Client-Side Rendering: Captures the live React DOM node directly in the user's browser using `html2canvas` and `jsPDF`.
 * - Zero Server Upload: Certificate images and sensitive personal identity details are never transmitted to any external backend for rendering.
 * - Print-Ready Fidelity: Scales canvas capture up to 2.5x to ensure razor-sharp text and crisp QR codes exceeding 1920px resolution.
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Configuration options for export operations.
 */
export interface ExportOptions {
  /** DOM element ID of the CertificatePreview container */
  elementId: string;
  /** Custom export file name override */
  filename?: string;
  /** Certificate Title used to generate meaningful filenames */
  certificateTitle?: string;
  /** Recipient Name used to generate meaningful filenames */
  recipientName?: string;
}

/**
 * Captures target DOM certificate element into an HTML5 Canvas at 2.5x pixel scale.
 * @param elementId - ID of the container element to capture.
 * @returns High-resolution HTMLCanvasElement.
 */
async function captureElementToCanvas(elementId: string): Promise<HTMLCanvasElement> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Certificate DOM element with id "${elementId}" not found.`);
  }

  // Scale by 2.5x for ultra-sharp, publication-quality raster output (>=1920px width)
  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#020617', // Match dark slate-950 container background
    logging: false,
  });

  return canvas;
}

/**
 * Generates and triggers a browser download for a high-resolution PNG image.
 * @param options - Export configuration options.
 */
export async function exportToPng({
  elementId,
  filename,
  certificateTitle = 'Certificate',
  recipientName = 'Recipient',
}: ExportOptions): Promise<void> {
  // Step 1: Capture DOM element to canvas
  const canvas = await captureElementToCanvas(elementId);
  const dataUrl = canvas.toDataURL('image/png', 1.0);

  // Step 2: Sanitize and construct output filename
  const cleanFilename =
    filename ||
    `CertiChain-${certificateTitle.replace(/[^a-z0-9]/gi, '_')}-${recipientName.replace(/[^a-z0-9]/gi, '_')}.png`;

  // Step 3: Trigger browser file download via temporary anchor element
  const link = document.createElement('a');
  link.download = cleanFilename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and triggers a browser download for a print-ready Landscape A4 PDF.
 * @param options - Export configuration options.
 */
export async function exportToPdf({
  elementId,
  filename,
  certificateTitle = 'Certificate',
  recipientName = 'Recipient',
}: ExportOptions): Promise<void> {
  // Step 1: Capture high-res canvas
  const canvas = await captureElementToCanvas(elementId);
  const imgData = canvas.toDataURL('image/png', 1.0);

  // Step 2: Instantiate jsPDF in Landscape A4 mode (297mm width x 210mm height)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Step 3: Compute optimal aspect ratio and center certificate with 10mm margins
  const margin = 10;
  const availWidth = pdfWidth - margin * 2;
  const availHeight = pdfHeight - margin * 2;

  const canvasRatio = canvas.width / canvas.height;
  let renderWidth = availWidth;
  let renderHeight = renderWidth / canvasRatio;

  if (renderHeight > availHeight) {
    renderHeight = availHeight;
    renderWidth = renderHeight * canvasRatio;
  }

  const posX = (pdfWidth - renderWidth) / 2;
  const posY = (pdfHeight - renderHeight) / 2;

  // Step 4: Render image into the PDF canvas
  pdf.addImage(imgData, 'PNG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');

  // Step 5: Save PDF file directly to client
  const cleanFilename =
    filename ||
    `CertiChain-${certificateTitle.replace(/[^a-z0-9]/gi, '_')}-${recipientName.replace(/[^a-z0-9]/gi, '_')}.pdf`;

  pdf.save(cleanFilename);
}

