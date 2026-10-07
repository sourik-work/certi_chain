import React, { useState } from 'react';
import { CertificateMetadata } from '../types/certificate';
import { resolveCustomCertificateInfo } from '../lib/customMetadataHelper';
import { Image as ImageIcon, FileDown, Loader2 } from 'lucide-react';

export interface CustomCertificatePreviewProps {
  renderedDataUrl: string;
  metadata: Partial<CertificateMetadata>;
  showExportControls?: boolean;
  id?: string;
  className?: string;
}

export const CustomCertificatePreview: React.FC<CustomCertificatePreviewProps> = ({
  renderedDataUrl,
  metadata,
  showExportControls = true,
  id = 'custom-certificate-preview-node',
  className = '',
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const {
    recipientName,
    certificateTitle,
  } = resolveCustomCertificateInfo(metadata);

  const handleDownloadPng = () => {
    const a = document.createElement('a');
    const safeTitle = (certificateTitle || 'Certificate').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = (recipientName || 'Recipient').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `CertiChain-${safeTitle}-${safeName}.png`;
    a.href = renderedDataUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = renderedDataUrl;
      await new Promise<void>((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve();
        } else {
          img.onload = () => resolve();
          img.onerror = (e) => reject(e);
        }
      });

      const imgWidth = img.naturalWidth || img.width || 1200;
      const imgHeight = img.naturalHeight || img.height || 800;
      const isLandscape = imgWidth >= imgHeight;

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const availW = pageWidth - margin * 2;
      const availH = pageHeight - margin * 2;

      const ratio = imgWidth / imgHeight;
      let renderW = availW;
      let renderH = renderW / ratio;

      if (renderH > availH) {
        renderH = availH;
        renderW = renderH * ratio;
      }

      const posX = (pageWidth - renderW) / 2;
      const posY = (pageHeight - renderH) / 2;

      pdf.addImage(renderedDataUrl, 'PNG', posX, posY, renderW, renderH, undefined, 'FAST');
      const safeTitle = (certificateTitle || 'Certificate').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeName = (recipientName || 'Recipient').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`CertiChain-${safeTitle}-${safeName}.pdf`);
    } catch (err) {
      console.error('Download PDF failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className={`w-full space-y-4 select-none ${className}`}>
      {/* High-Resolution Verified Rendered Artifact Node */}
      <div
        id={id}
        className="relative w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex items-center justify-center p-1 sm:p-2"
      >
        <img
          src={renderedDataUrl}
          alt={certificateTitle}
          className="w-full h-auto object-contain rounded-xl max-h-[85vh]"
          loading="eager"
        />
      </div>

      {/* Screen-reader descriptor for accessibility */}
      <span className="sr-only">
        {recipientName} — {certificateTitle}
      </span>

      {/* Download Action Controls */}
      {showExportControls && (
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="btn-primary text-xs flex items-center gap-1.5 shrink-0"
            title="Download Print-Ready PDF"
          >
            {isExportingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"
            title="Download High-Res PNG"
          >
            <ImageIcon className="w-3.5 h-3.5 text-azure-600" />
            <span>Download PNG</span>
          </button>
        </div>
      )}
    </div>
  );
};
