/**
 * @file export.ts
 * @summary Single Responsibility: Captures CertificatePreview DOM element and exports high-resolution PNG (>=1920px) and print-ready PDF.
 *
 * Implements client-side rendering via html2canvas and jsPDF (FR-5.2, FR-5.3).
 * Ensures zero server round-trip of sensitive certificate visual data.
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface ExportOptions {
  elementId: string;
  filename?: string;
  certificateTitle?: string;
  recipientName?: string;
}

/**
 * Captures target certificate element to canvas with high pixel scale (>=1920px width).
 */
async function captureElementToCanvas(elementId: string): Promise<HTMLCanvasElement> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Certificate DOM element with id "${elementId}" not found.`);
  }

  // Use higher scale for crisp high-res output (>=1920px)
  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#020617', // slate-950
    logging: false,
  });

  return canvas;
}

/**
 * Exports certificate as high-resolution PNG (FR-5.2).
 */
export async function exportToPng({
  elementId,
  filename,
  certificateTitle = 'Certificate',
  recipientName = 'Recipient',
}: ExportOptions): Promise<void> {
  const canvas = await captureElementToCanvas(elementId);
  const dataUrl = canvas.toDataURL('image/png', 1.0);

  const cleanFilename =
    filename ||
    `CertiChain-${certificateTitle.replace(/[^a-z0-9]/gi, '_')}-${recipientName.replace(/[^a-z0-9]/gi, '_')}.png`;

  const link = document.createElement('a');
  link.download = cleanFilename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports certificate as print-ready PDF in landscape A4 format (FR-5.2, FR-5.3).
 */
export async function exportToPdf({
  elementId,
  filename,
  certificateTitle = 'Certificate',
  recipientName = 'Recipient',
}: ExportOptions): Promise<void> {
  const canvas = await captureElementToCanvas(elementId);
  const imgData = canvas.toDataURL('image/png', 1.0);

  // Landscape A4 dimensions: 297mm x 210mm
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Margins & aspect ratio scaling
  const margin = 10; // 10mm margin
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

  pdf.addImage(imgData, 'PNG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');

  const cleanFilename =
    filename ||
    `CertiChain-${certificateTitle.replace(/[^a-z0-9]/gi, '_')}-${recipientName.replace(/[^a-z0-9]/gi, '_')}.pdf`;

  pdf.save(cleanFilename);
}
