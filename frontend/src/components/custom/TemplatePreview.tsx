/**
 * Live Custom Template Preview Component
 * Renders the custom certificate with dynamic user-entered form values overlaying the original template.
 */

import React, { useRef, useEffect, useState } from 'react';
import type { CertificateTemplate } from '../../types/customTemplate';
import { renderCustomCertificateCanvas } from '../../lib/renderCertificate';
import { FileDown, Image, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface TemplatePreviewProps {
  template: CertificateTemplate;
  values: Record<string, string>;
  certId?: string;
  proofHash?: string;
  verificationUrl?: string;
  showExportButtons?: boolean;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  values,
  certId,
  proofHash,
  verificationUrl,
  showExportButtons = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  // Debounced live canvas re-render when values or template definition changes
  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsRendering(true);
      try {
        const result = await renderCustomCertificateCanvas({
          template,
          values,
          certId,
          proofHash,
          verificationUrl,
        });
        if (!isCancelled) {
          setPreviewDataUrl(result.pngDataUrl);
        }
      } catch (err) {
        console.error('Failed to render template preview canvas:', err);
      } finally {
        if (!isCancelled) setIsRendering(false);
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [template, values, certId, proofHash, verificationUrl]);

  const handleDownloadPng = async () => {
    setIsExportingPng(true);
    try {
      const result = await renderCustomCertificateCanvas({
        template,
        values,
        certId,
        proofHash,
        verificationUrl,
      });

      const a = document.createElement('a');
      a.download = `CertiChain-${(values.recipientName || 'Certificate').replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      a.href = result.pngDataUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download PNG failed:', err);
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const result = await renderCustomCertificateCanvas({
        template,
        values,
        certId,
        proofHash,
        verificationUrl,
      });

      const isLandscape = template.orientation === 'landscape';
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(result.pngDataUrl, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      pdf.save(`CertiChain-${(values.recipientName || 'Certificate').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.error('Download PDF failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const aspectRatio = `${template.widthPx || 1920} / ${template.heightPx || 1080}`;

  return (
    <div className="w-full space-y-4 select-none">
      <div
        ref={containerRef}
        style={{ aspectRatio }}
        className="relative w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex items-center justify-center"
      >
        {previewDataUrl ? (
          <img
            src={previewDataUrl}
            alt="Live Rendered Certificate Preview"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-azure-500" />
            <span>Rendering certificate layout...</span>
          </div>
        )}

        {isRendering && (
          <div className="absolute top-3 right-3 bg-navy-950/80 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5 shadow backdrop-blur-sm">
            <Loader2 className="w-3 h-3 animate-spin text-azure-400" />
            <span>Syncing</span>
          </div>
        )}
      </div>

      {showExportButtons && (
        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf || !previewDataUrl}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            {isExportingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-navy-900 dark:text-azure-400" />
            )}
            <span>Download PDF (Print-Ready A4)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isExportingPng || !previewDataUrl}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            {isExportingPng ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Image className="w-3.5 h-3.5 text-azure-600" />
            )}
            <span>Download PNG (High-Res)</span>
          </button>
        </div>
      )}
    </div>
  );
};
