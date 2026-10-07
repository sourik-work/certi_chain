/**
 * Custom Certificate Template Uploader Component (Step 1)
 * Handles drag-and-drop file ingestion, magic-byte sniffing, EXIF stripping,
 * SVG sanitization, PDF page 1 rasterization, and instant SHA-256 hashing.
 */

import React, { useState, useRef, useCallback } from 'react';
import { Upload, AlertCircle, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { sanitizeSvg } from '../../lib/sanitizeSvg';
import { stripExifFromImage } from '../../lib/stripExif';
import { rasterizePdfPageOne } from '../../lib/pdfRaster';
import { base64ToUint8Array, sha256Bytes, MAX_UPLOAD_BYTES, MAX_ARTIFACT_BYTES } from '../../lib/bytes';

export interface UploadedTemplatePayload {
  file: File;
  previewDataUrl: string;
  templateHash: string;
  mimeType: string;
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait';
  fileName: string;
  fileSizeBytes: number;
}

interface TemplateUploaderProps {
  onTemplateUploaded: (payload: UploadedTemplatePayload) => void;
  isProcessing?: boolean;
}

const MAX_FILE_SIZE_BYTES = MAX_UPLOAD_BYTES; // 8 MB raw upload ceiling

export const TemplateUploader: React.FC<TemplateUploaderProps> = ({
  onTemplateUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [uploadedFileSummary, setUploadedFileSummary] = useState<UploadedTemplatePayload | null>(null);

  /**
   * Sniffs magic bytes to verify genuine file type
   */
  const sniffMimeType = async (file: File): Promise<string> => {
    const slice = file.slice(0, 8);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    // PDF: 25 50 44 46 (%PDF)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'application/pdf';
    }
    // WEBP: RIFF....WEBP
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      file.type === 'image/webp'
    ) {
      return 'image/webp';
    }
    // SVG text check
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      const text = await file.slice(0, 200).text();
      if (text.toLowerCase().includes('<svg') || text.toLowerCase().includes('<?xml')) {
        return 'image/svg+xml';
      }
    }

    return file.type || 'application/octet-stream';
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setWarningMessage(null);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 8 MB upload limit.`);
      return;
    }

    try {
      setLoadingStep('Sniffing file headers & validating format...');
      const sniffedMime = await sniffMimeType(file);

      const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/svg+xml'];
      if (!allowedMimes.includes(sniffedMime)) {
        throw new Error(
          `Unsupported file format (${sniffedMime}). Please upload a valid PNG, JPG, WEBP, PDF, or SVG certificate.`
        );
      }

      const rawBuffer = await file.arrayBuffer();
      let previewDataUrl = '';
      let width = 1920;
      let height = 1080;

      if (sniffedMime === 'application/pdf') {
        setLoadingStep('Rasterizing PDF Page 1 at 2x resolution...');
        const pdfResult = await rasterizePdfPageOne(rawBuffer, 2.0);
        previewDataUrl = pdfResult.dataUrl;
        width = pdfResult.width;
        height = pdfResult.height;
        if (pdfResult.numPages > 1) {
          setWarningMessage(`Multi-page PDF detected (${pdfResult.numPages} pages). Page 1 is used for certificate design.`);
        }
      } else if (sniffedMime === 'image/svg+xml') {
        setLoadingStep('Sanitizing vector SVG markup...');
        const rawSvgText = await file.text();
        const sanitizeRes = sanitizeSvg(rawSvgText);
        if (!sanitizeRes.isValid) {
          setWarningMessage('SVG contained unsafe tags or scripts which were sanitized.');
        }
        previewDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(sanitizeRes.sanitizedSvg)}`;

        // Read dimensions
        const img = new Image();
        img.src = previewDataUrl;
        await new Promise<void>((res) => {
          img.onload = () => {
            width = img.naturalWidth || 1920;
            height = img.naturalHeight || 1080;
            res();
          };
          img.onerror = () => res();
        });
      } else {
        setLoadingStep('Stripping EXIF/GPS metadata headers & optimizing...');
        const stripped = await stripExifFromImage(file);
        previewDataUrl = stripped.cleanDataUrl;

        const img = new Image();
        img.src = previewDataUrl;
        await new Promise<void>((res) => {
          img.onload = () => {
            width = img.naturalWidth || 1920;
            height = img.naturalHeight || 1080;
            res();
          };
          img.onerror = () => res();
        });
      }

      // Compute templateHash over the exact sanitized bytes that will be pinned to IPFS
      setLoadingStep('Computing cryptographic SHA-256 digest...');
      const cleanBytes = base64ToUint8Array(previewDataUrl);

      if (cleanBytes.length > MAX_ARTIFACT_BYTES) {
        const mb = (cleanBytes.length / (1024 * 1024)).toFixed(2);
        throw new Error(`Template is ${mb} MB, must be under 3.2 MB. Re-export at 3200px or use WebP.`);
      }

      // Invariant: hash the exact bytes that will be pinned. Do NOT re-encode.
      const templateHash = await sha256Bytes(cleanBytes);

      // Resolution Check Warning
      const longEdge = Math.max(width, height);
      if (longEdge < 1200) {
        setWarningMessage(`Image resolution (${width}x${height}) is under recommended 1200px long edge.`);
      }

      const orientation: 'landscape' | 'portrait' = width >= height ? 'landscape' : 'portrait';

      const payload: UploadedTemplatePayload = {
        file,
        previewDataUrl,
        templateHash,
        mimeType: sniffedMime,
        width,
        height,
        orientation,
        fileName: file.name,
        fileSizeBytes: file.size,
      };

      setUploadedFileSummary(payload);
      onTemplateUploaded(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoadingStep(null);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf,image/svg+xml,.pdf,.png,.jpg,.jpeg,.webp,.svg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
          isDragging
            ? 'border-azure-500 bg-azure-50/50 dark:bg-azure-950/30 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-700 hover:border-navy-900 dark:hover:border-slate-500 bg-slate-50/60 dark:bg-slate-900/40'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-azure-600 dark:text-azure-400 group-hover:scale-105 transition-transform">
          {loadingStep ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <Upload className="w-8 h-8" />
          )}
        </div>

        <div className="space-y-1">
          <h3 className="font-bold text-base sm:text-lg text-navy-950 dark:text-white">
            {loadingStep ? 'Processing Template...' : 'Upload Certificate Design'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md">
            Drag & drop your certificate file here, or click to browse. Supports{' '}
            <strong className="text-slate-700 dark:text-slate-300">PNG, JPG, WEBP, PDF, or SVG</strong> (max 8 MB).
          </p>
        </div>

        {loadingStep && (
          <div className="flex items-center gap-2 text-xs text-azure-600 font-medium animate-pulse">
            <span>{loadingStep}</span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Warning Banner */}
      {warningMessage && (
        <div className="p-4 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Uploaded File Confirmation Summary */}
      {uploadedFileSummary && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-navy-950 dark:text-white truncate max-w-xs">
                {uploadedFileSummary.fileName}
              </h4>
              <p className="text-[11px] text-slate-500 font-mono">
                {uploadedFileSummary.width} x {uploadedFileSummary.height}px •{' '}
                {(uploadedFileSummary.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB • {uploadedFileSummary.orientation}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs sm:max-w-md">
                Hash: {uploadedFileSummary.templateHash}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-xs flex items-center justify-center gap-1.5 py-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Replace File</span>
          </button>
        </div>
      )}
    </div>
  );
};
