import React, { useState, useEffect } from 'react';
import {
  parseFigmaUrl,
  importFigmaTemplate,
  listFigmaFrames,
  getSavedFigmaToken,
  saveFigmaToken,
  FigmaFrameSummary,
} from '../../lib/template/figma';
import { TemplateSpec } from '../../lib/template/types';
import {
  X,
  Sparkles,
  Key,
  Link,
  Layers,
  HelpCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Tag,
  ArrowRight,
} from 'lucide-react';

interface FigmaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateReady: (spec: TemplateSpec, originalImageDataUrl: string) => void;
  initialOcrSpec?: TemplateSpec | null;
  onSkip?: () => void;
  isPromptMode?: boolean;
}

export const FigmaImportModal: React.FC<FigmaImportModalProps> = ({
  isOpen,
  onClose,
  onTemplateReady,
  initialOcrSpec = null,
  onSkip,
  isPromptMode = false,
}) => {
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [rememberToken, setRememberToken] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Connecting to Figma API...');
  const [loadingPct, setLoadingPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Frames selection state (if multiple frames found)
  const [frames, setFrames] = useState<FigmaFrameSummary[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedFigmaToken();
      if (saved) {
        setFigmaToken(saved);
      }
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImport = async (overrideNodeId?: string) => {
    setErrorMsg(null);

    const parsed = parseFigmaUrl(figmaUrl);
    if (!parsed) {
      setErrorMsg('Please enter a valid Figma file or frame URL (e.g. https://www.figma.com/design/KEY/Title?node-id=1-2)');
      return;
    }

    if (!figmaToken.trim()) {
      setErrorMsg('Please provide a Figma Personal Access Token (PAT).');
      return;
    }

    if (rememberToken) {
      saveFigmaToken(figmaToken);
    }

    const targetNodeId = overrideNodeId || parsed.nodeId || selectedFrameId || undefined;

    setIsLoading(true);
    setLoadingStep('Connecting to Figma...');
    setLoadingPct(10);

    try {
      // If no node ID is specified in URL or selection, check if multiple frames exist
      if (!targetNodeId) {
        setLoadingStep('Listing frames in Figma file...');
        setLoadingPct(25);
        const fetchedFrames = await listFigmaFrames(parsed.fileKey, figmaToken);

        if (fetchedFrames.length > 1) {
          setFrames(fetchedFrames);
          setSelectedFrameId(fetchedFrames[0].id);
          setIsLoading(false);
          return;
        }
      }

      const spec = await importFigmaTemplate(
        parsed.fileKey,
        targetNodeId,
        figmaToken,
        (msg, pct) => {
          setLoadingStep(msg);
          setLoadingPct(pct);
        },
        initialOcrSpec || undefined
      );

      onTemplateReady(spec, spec.background.dataUrl);
      onClose();
    } catch (err: any) {
      console.error('Figma import failed:', err);
      setErrorMsg(err.message || 'Failed to import template from Figma.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipAction = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  const isConnectingWithOcr = Boolean(initialOcrSpec && initialOcrSpec.fields.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 text-white flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z"/>
                <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z"/>
                <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z"/>
                <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z"/>
                <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-navy-950 dark:text-white">
                {isPromptMode || isConnectingWithOcr
                  ? "We've extracted your variables!"
                  : 'Import from Figma'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isPromptMode || isConnectingWithOcr
                  ? 'Would you like to connect this template to a Figma file to perfectly sync layers, typography, and exact coordinates?'
                  : 'Directly import frames, vector artwork, fonts & tokenized layers'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Extracted Variables Chip Strip (if connecting with OCR) */}
          {isConnectingWithOcr && initialOcrSpec && initialOcrSpec.fields.length > 0 && (
            <div className="p-3.5 bg-azure-50/70 dark:bg-azure-950/30 border border-azure-200/80 dark:border-azure-800/60 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold text-azure-700 dark:text-azure-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5" />
                {initialOcrSpec.fields.length} Extracted Dynamic Variables Ready to Sync:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {initialOcrSpec.fields.map((f) => (
                  <span
                    key={f.key}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-white dark:bg-slate-800 border border-azure-200 dark:border-azure-700 text-azure-800 dark:text-azure-200 shadow-2xs"
                  >
                    <code className="font-bold">{`{{${f.key}}}`}</code>
                    <span className="text-slate-400 text-[10px]">({f.label})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* URL Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-navy-950 dark:text-slate-200">
              Figma File or Frame URL *
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="https://www.figma.com/design/AbCdEf12345/Certificate-Template?node-id=1-2"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                disabled={isLoading}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-navy-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-azure-500/20 focus:border-azure-500"
              />
              <Link className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tip: Right-click any Frame in Figma and select <span className="font-semibold text-slate-700 dark:text-slate-300">Copy link to selection</span> to target a specific certificate.
            </p>
          </div>

          {/* Token Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-navy-950 dark:text-slate-200">
                Figma Personal Access Token (PAT) *
              </label>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-[11px] text-azure-600 dark:text-azure-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>How do I get a token?</span>
                {showHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="figd_..."
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                disabled={isLoading}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs font-mono text-navy-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-azure-500/20 focus:border-azure-500"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberToken}
                  onChange={(e) => setRememberToken(e.target.checked)}
                  className="rounded border-slate-300 text-azure-600 focus:ring-azure-500/20"
                />
                <span>Remember token in this browser</span>
              </label>

              <span className="text-[10px] text-slate-400">
                Read-only access is sufficient
              </span>
            </div>
          </div>

          {/* Help Accordion */}
          {showHelp && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs space-y-2.5 animate-in fade-in duration-150">
              <h5 className="font-bold text-navy-950 dark:text-white flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-azure-600" />
                How to generate a Figma Personal Access Token
              </h5>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                <li>Log in to your <a href="https://www.figma.com" target="_blank" rel="noreferrer" className="text-azure-600 underline">Figma account</a>.</li>
                <li>Click your profile avatar in the top-left and select <strong>Settings</strong>.</li>
                <li>Scroll down to the <strong>Personal access tokens</strong> section.</li>
                <li>Click <strong>Generate new token</strong>, give it a name (e.g. <em>CertiChain</em>), select <strong>Read-only (File content)</strong> scope, and copy the generated token.</li>
              </ol>

              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                💡 <strong>Pro Tip for Designers:</strong> Name your text layers with double braces like <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-[10px] text-navy-900 dark:text-slate-200">{`{{recipient_name}}`}</code>, <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-[10px] text-navy-900 dark:text-slate-200">{`{{event_name}}`}</code>, or create a rectangle named <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-[10px] text-navy-900 dark:text-slate-200">qr_placement</code> for automatic variable mapping!
              </div>
            </div>
          )}

          {/* Multiple Frames Picker (if triggered) */}
          {frames.length > 0 && !isLoading && (
            <div className="space-y-2 p-4 bg-azure-50/50 dark:bg-azure-950/20 border border-azure-200 dark:border-azure-800 rounded-2xl">
              <label className="block text-xs font-bold text-navy-950 dark:text-slate-200">
                Select Certificate Frame ({frames.length} found):
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                {frames.map((frame) => (
                  <button
                    key={frame.id}
                    type="button"
                    onClick={() => setSelectedFrameId(frame.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-left text-xs border transition-all ${
                      selectedFrameId === frame.id
                        ? 'border-azure-500 bg-azure-500/10 text-azure-700 dark:text-azure-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Layers className="w-4 h-4 text-azure-600 shrink-0" />
                      <span className="truncate">{frame.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                      {frame.width} × {frame.height}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {isLoading && (
            <div className="p-5 bg-azure-50/60 dark:bg-slate-800/80 border border-azure-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center space-y-3">
              <div className="relative">
                <Loader2 className="w-8 h-8 text-azure-600 animate-spin" />
                <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="w-full space-y-1.5 text-center max-w-sm">
                <p className="text-xs font-bold text-navy-950 dark:text-slate-100">
                  {loadingStep}
                </p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${loadingPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {loadingPct}% complete
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-bold block">Import Error</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          {isPromptMode || onSkip ? (
            <button
              type="button"
              onClick={handleSkipAction}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Skip for now
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={() => handleImport(selectedFrameId || undefined)}
            disabled={isLoading || !figmaUrl.trim() || !figmaToken.trim()}
            className="btn-primary px-5 py-2 text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-azure-600/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing Figma...</span>
              </>
            ) : (
              <>
                <span>Connect Figma URL</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
