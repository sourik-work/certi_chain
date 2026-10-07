/**
 * Design Tool Provider Picker Component
 * Offers Canva Connect, Figma Bridge, and Built-In Quick Editor options.
 */

import React, { useState } from 'react';
import type { CertificateTemplate } from '../../types/customTemplate';
import { FigmaEditorProvider } from '../../lib/editors/figma';
import { CanvaEditorProvider } from '../../lib/editors/canva';
import { Sparkles, Edit3, ExternalLink, Copy, Download, Check, AlertCircle, Loader2 } from 'lucide-react';

interface EditorProviderPickerProps {
  template: CertificateTemplate;
  onOpenQuickEditor: () => void;
  onImportEditedTemplate?: (updatedTemplate: CertificateTemplate, sourceName: string) => void;
}

export const EditorProviderPicker: React.FC<EditorProviderPickerProps> = ({
  template,
  onOpenQuickEditor,
}) => {
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [isOpeningCanva, setIsOpeningCanva] = useState(false);
  const [canvaNotice, setCanvaNotice] = useState<string | null>(null);

  const figmaProvider = new FigmaEditorProvider();
  const canvaProvider = new CanvaEditorProvider();

  const handleCopyFigmaSvg = () => {
    const svgText = figmaProvider.generateFigmaSvg(template);
    navigator.clipboard.writeText(svgText);
    setCopiedSvg(true);
    setTimeout(() => setCopiedSvg(false), 3000);
  };

  const handleDownloadFigmaSvg = () => {
    const svgText = figmaProvider.generateFigmaSvg(template);
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CertiChain-${(template.fields[0]?.label || 'Template').replace(/[^a-zA-Z0-9]/g, '_')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenCanva = async () => {
    setIsOpeningCanva(true);
    setCanvaNotice(null);
    try {
      // Create template blob
      const res = await fetch(template.previewDataUrl || '');
      const blob = await res.blob();
      const session = await canvaProvider.sendTemplate(blob, { title: 'Certificate Design' });

      if (session.editUrl) {
        window.open(session.editUrl, '_blank', 'noopener,noreferrer');
        setCanvaNotice('Opened Canva in a new tab. After editing, export your design as PNG and upload it below.');
      }
    } catch (err: unknown) {
      console.warn('Canva handoff notice:', err);
      setCanvaNotice('Canva Connect Sandbox: opened Canva in new tab. Export and re-upload your finished design below.');
      window.open('https://www.canva.com/design/new', '_blank', 'noopener,noreferrer');
    } finally {
      setIsOpeningCanva(false);
    }
  };

  return (
    <div className="space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="font-serif font-bold text-base text-navy-950 dark:text-white">
            Design & Layout Tool Integration
          </h3>
          <p className="text-xs text-slate-500">
            Fine-tune typography or enhance your design in Canva, Figma, or the built-in studio.
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-azure-600 bg-azure-50 dark:bg-azure-950/40 px-2.5 py-1 rounded-full border border-azure-200 dark:border-azure-800">
          Re-Import Supported
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Option A: Quick Editor (Built-in) */}
        <div className="border border-azure-300 dark:border-azure-800 bg-azure-50/40 dark:bg-azure-950/20 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-azure-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Edit3 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-navy-950 dark:text-white">Quick Edit Here</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Adjust typography, move text boxes, and change colors directly in your browser. No external account needed.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenQuickEditor}
            className="btn-primary text-xs w-full py-2.5 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Launch Quick Editor</span>
          </button>
        </div>

        {/* Option B: Figma Bridge */}
        <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-sm">
              <span className="text-sm font-extrabold">Fg</span>
            </div>
            <h4 className="font-bold text-sm text-navy-950 dark:text-white">Figma Integration</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Export SVG with named layer structure (<code className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">field:key</code>) for pixel-perfect vector editing.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleCopyFigmaSvg}
              className="btn-secondary text-xs w-full py-2 flex items-center justify-center gap-1.5"
            >
              {copiedSvg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSvg ? 'SVG Copied to Clipboard!' : 'Copy SVG for Figma'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadFigmaSvg}
              className="btn-secondary text-xs w-full py-2 flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Vector SVG</span>
            </button>
          </div>
        </div>

        {/* Option C: Canva Connect */}
        <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold shadow-sm">
              <span className="text-sm font-extrabold">Cv</span>
            </div>
            <h4 className="font-bold text-sm text-navy-950 dark:text-white">Canva Connect</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Open your certificate template in Canva to enrich borders, seals, and visual elements.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCanva}
            disabled={isOpeningCanva}
            className="btn-secondary text-xs w-full py-2.5 flex items-center justify-center gap-1.5"
          >
            {isOpeningCanva ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
            <span>Open in Canva</span>
          </button>
        </div>
      </div>

      {canvaNotice && (
        <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-900 flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
          <span>{canvaNotice}</span>
        </div>
      )}
    </div>
  );
};
