/**
 * @file export.ts
 * @summary Exports template-based certificates to high-resolution PNG (at natural canvas resolution)
 * and custom-sized PDF matching the template aspect ratio using html2canvas and jsPDF.
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { TemplateSpec } from './types';

export interface TemplateExportOptions {
  elementId: string;
  spec: TemplateSpec;
  filename?: string;
  certificateTitle?: string;
  recipientName?: string;
}

/**
 * Ensures all web fonts are loaded before capturing the DOM element.
 */
async function waitForFontsReady(): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font wait failures
    }
  }
}

/**
 * Captures template certificate container element at natural resolution.
 */
async function captureTemplateElement(elementId: string): Promise<HTMLCanvasElement> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Template certificate element "#${elementId}" not found in DOM.`);
  }

  await waitForFontsReady();

  // Capture at crisp 2x scale with transform reset to natural dimensions
  const canvas = await html2canvas(element, {
    scale: 2.0,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#FFFFFF',
    logging: false,
    onclone: (clonedDoc) => {
      const clonedEl = clonedDoc.getElementById(elementId);
      if (clonedEl) {
        clonedEl.style.transform = 'none';
      }
    },
  });

  return canvas;
}

/**
 * Exports custom template certificate as high-resolution PNG.
 */
export async function exportTemplateToPng({
  elementId,
  spec,
  filename,
  certificateTitle = 'Certificate',
  recipientName = 'Recipient',
}: TemplateExportOptions): Promise<void> {
  const canvas = await captureTemplateElement(elementId);
  const dataUrl = canvas.toDataURL('image/png', 1.0);

  const cleanTitle = (certificateTitle || spec.name).replace(/[^a-z0-9_-]/gi, '_');
  const cleanRecipient = recipientName.replace(/[^a-z0-9_-]/gi, '_');
  const cleanFilename = filename || `CertiChain-${cleanTitle}-${cleanRecipient}.png`;

  const link = document.createElement('a');
  link.download = cleanFilename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports custom template certificate as PDF sized perfectly to the template aspect ratio.
 */
export async function exportTemplateToPdf({
  elementId,
  spec,
  filename,
  certificateTitle = 'Certificate',
  recipientName = 'Recipient',
}: TemplateExportOptions): Promise<void> {
  const canvas = await captureTemplateElement(elementId);
  const imgData = canvas.toDataURL('image/png', 1.0);

  // Compute dimensions in millimeters for PDF
  const aspect = spec.canvas.width / spec.canvas.height;
  const orientation = aspect >= 1.0 ? 'landscape' : 'portrait';

  // Standard A4 reference size is 297 x 210 mm
  let pdfWidthMm = 297;
  let pdfHeightMm = 210;

  if (aspect >= 1.0) {
    // Landscape custom page fitting aspect
    pdfWidthMm = 297;
    pdfHeightMm = pdfWidthMm / aspect;
  } else {
    // Portrait custom page fitting aspect
    pdfHeightMm = 297;
    pdfWidthMm = pdfHeightMm * aspect;
  }

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pdfWidthMm, pdfHeightMm],
  });

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');

  const cleanTitle = (certificateTitle || spec.name).replace(/[^a-z0-9_-]/gi, '_');
  const cleanRecipient = recipientName.replace(/[^a-z0-9_-]/gi, '_');
  const cleanFilename = filename || `CertiChain-${cleanTitle}-${cleanRecipient}.pdf`;

  pdf.save(cleanFilename);
}
