import React, { useState, useRef } from 'react';
import { processUploadImage, getImagePixelData, pixelDataToDataUrl } from '../../lib/template/image';
import { inpaintRegionsAsync } from '../../lib/template/inpaint';
import { AnalysisPipeline } from '../../lib/template/analyze';
import { TemplateSpec } from '../../lib/template/types';
import { UploadCloud, Loader2, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { FigmaImportModal } from './FigmaImportModal';

interface TemplateUploaderProps {
  onTemplateReady: (spec: TemplateSpec, originalImageDataUrl: string) => void;
}

export const TemplateUploader: React.FC<TemplateUploaderProps> = ({ onTemplateReady }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('Processing image...');
  const [progressPct, setProgressPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFigmaModal, setShowFigmaModal] = useState(false);
  const [isPromptMode, setIsPromptMode] = useState(false);
  const [pendingOcrSpec, setPendingOcrSpec] = useState<TemplateSpec | null>(null);
  const [pendingOriginalDataUrl, setPendingOriginalDataUrl] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setIsAnalyzing(true);
    setProgressMsg(file.type === 'application/pdf' ? 'Rendering PDF page...' : 'Reading image & stripping metadata...');
    setProgressPct(10);

    try {
      // 1. Process and downscale image through canvas
      const processed = await processUploadImage(file);
      setProgressPct(30);
      setProgressMsg('Detecting text layout & visual regions...');

      // 2. Run analysis pipeline (Vision -> OCR -> Manual)
      const analysis = await AnalysisPipeline.analyze(
        processed.dataUrl,
        processed.width,
        processed.height,
        {
          onProgress: (msg, pct) => {
            setProgressMsg(msg);
            setProgressPct(pct);
          },
        }
      );

      // 3b. Compute clean QR placement & readable verification strip
      const qrW = Math.round(processed.width * 0.085);
      const qrH = qrW;
      const qrX = Math.round(processed.width * 0.81);
      const qrY = Math.round(processed.height * 0.73);

      // 4. Inpaint variable regions asynchronously so the background is cleanly erased
      let backgroundDataUrl = processed.dataUrl;
      let erasedBackground = false;

      try {
        setProgressMsg('Inpainting background text regions...');
        setProgressPct(90);

        const pixelData = await getImagePixelData(
          processed.dataUrl,
          processed.width,
          processed.height
        );
        const eraseRects = (analysis.blocks || [])
          .filter((b) => b.role === 'variable' || b.role === 'paragraph' || b.eraseOnly)
          .map((b) => b.rect);

        if (eraseRects.length > 0) {
          const inpainted = await inpaintRegionsAsync(
            pixelData.data,
            processed.width,
            processed.height,
            eraseRects
          );
          backgroundDataUrl = pixelDataToDataUrl(
            inpainted.data,
            processed.width,
            processed.height,
            'image/jpeg',
            0.9
          );
          erasedBackground = true;
        }
      } catch (inpaintErr) {
        console.warn('Initial background inpaint skipped:', inpaintErr);
      }

      const templateSpec: TemplateSpec = {
        schema: 'certichain.template/v1',
        id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: analysis.suggestedName || file.name.replace(/\.[^/.]+$/, ''),
        createdAt: new Date().toISOString(),
        canvas: {
          width: processed.width,
          height: processed.height,
        },
        background: {
          mime: 'image/jpeg',
          dataUrl: backgroundDataUrl,
          erasedBackground,
        },
        blocks: analysis.blocks,
        fields: analysis.fields,
        qr: {
          rect: { x: qrX, y: qrY, w: qrW, h: qrH },
          caption: 'Scan to verify',
          tile: true,
        },
        verifyStrip: {
          rect: {
            x: Math.round(processed.width * 0.15),
            y: Math.round(processed.height * 0.935),
            w: Math.round(processed.width * 0.7),
            h: Math.round(processed.height * 0.035),
          },
          style: {
            fontFamily: 'Inter',
            fontWeight: 500,
            fontSize: Math.max(16, Math.round(processed.height * 0.016)),
            color: '#64748B',
            align: 'center',
            lineHeight: 1.2,
            letterSpacing: 0.5,
            transform: 'none',
            fit: 'none',
            maxLines: 1,
          },
        },
      };

      // Intercept transition to TemplateStudio and prompt user to connect Figma
      setPendingOcrSpec(templateSpec);
      setPendingOriginalDataUrl(processed.dataUrl);
      setIsPromptMode(true);
      setShowFigmaModal(true);
    } catch (err: unknown) {
      console.error('Template upload and analysis error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process certificate sample.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSkipPrompt = () => {
    setShowFigmaModal(false);
    if (pendingOcrSpec && pendingOriginalDataUrl) {
      onTemplateReady(pendingOcrSpec, pendingOriginalDataUrl);
      setPendingOcrSpec(null);
      setPendingOriginalDataUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Figma Direct Import Banner Card */}
      <div className="bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-azure-900/10 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-azure-950/40 border border-purple-300/60 dark:border-purple-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z"/>
              <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z"/>
              <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z"/>
              <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z"/>
              <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-navy-950 dark:text-white">
                Import from Figma
              </h4>
              <span className="bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                Pixel-Perfect
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Paste a Figma frame URL to import vector layers, exact typography & variable tokens.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsPromptMode(false);
            setShowFigmaModal(true);
          }}
          className="btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5 self-end sm:self-auto shrink-0 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold"
        >
          <span>Connect Figma URL</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* File Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isAnalyzing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer select-none ${
          isDragging
            ? 'border-azure-500 bg-azure-500/10 scale-[0.99]'
            : 'border-slate-300 dark:border-slate-700 hover:border-azure-400 bg-slate-50/50 dark:bg-slate-900/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />

        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-azure-600 animate-spin" />
              <Sparkles className="w-4 h-4 text-gold-500 absolute -top-1 -right-1 animate-pulse" />
            </div>

            <div className="space-y-2 max-w-xs">
              <p className="text-sm font-bold text-navy-950 dark:text-slate-100">
                {progressMsg}
              </p>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-azure-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {progressPct}% complete
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-azure-50 dark:bg-slate-800 text-azure-600 dark:text-azure-400 flex items-center justify-center shadow-sm">
              <UploadCloud className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-navy-950 dark:text-slate-100">
                Upload image or document
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Drag and drop your landscape certificate (JPG, PNG, WebP, or PDF up to 10 MB)
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
              <span className="bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                Auto-detects variable text
              </span>
              <span>•</span>
              <span className="bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                Strips EXIF
              </span>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Figma Import / Connect Prompt Modal */}
      <FigmaImportModal
        isOpen={showFigmaModal}
        onClose={() => {
          if (isPromptMode) {
            handleSkipPrompt();
          } else {
            setShowFigmaModal(false);
          }
        }}
        onSkip={handleSkipPrompt}
        isPromptMode={isPromptMode}
        initialOcrSpec={pendingOcrSpec}
        onTemplateReady={(spec, originalDataUrl) => {
          setShowFigmaModal(false);
          setIsPromptMode(false);
          setPendingOcrSpec(null);
          setPendingOriginalDataUrl(null);
          onTemplateReady(spec, originalDataUrl);
        }}
      />
    </div>
  );
};
