import React, { useState } from 'react';
import {
  TemplateSpec,
  TemplateBlock,
  TemplateField,
  Rect,
  QrPlacement,
  FieldMapTarget,
} from '../../lib/template/types';
import { StudioCanvas } from './StudioCanvas';
import { BlockInspector } from './BlockInspector';
import { FidelityDiff } from './FidelityDiff';
import { inpaintRegionsAsync } from '../../lib/template/inpaint';
import { getImagePixelData, pixelDataToDataUrl } from '../../lib/template/image';
import { saveTemplate, saveDraft } from '../../lib/template/store';
import { runTemplateHealthCheck, HealthCheckReport } from '../../lib/template/healthCheck';
import { OcrWord, estimateTextColor } from '../../lib/template/ocr';
import { exportTemplateToFigmaJson } from '../../lib/template/figma';
import { FigmaImportModal } from './FigmaImportModal';
import {
  MousePointer,
  Square,
  Hand,
  Undo2,
  Redo2,
  Sparkles,
  ShieldCheck,
  Check,
  Loader2,
  MousePointerClick,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
} from 'lucide-react';

interface TemplateStudioProps {
  initialSpec: TemplateSpec;
  originalImageDataUrl: string;
  initialOcrWords?: OcrWord[];
  manualModeNotice?: boolean;
  onSave: (savedSpec: TemplateSpec) => void;
  onCancel: () => void;
}

export const TemplateStudio: React.FC<TemplateStudioProps> = ({
  initialSpec,
  originalImageDataUrl,
  initialOcrWords = [],
  manualModeNotice = false,
  onSave,
  onCancel,
}) => {
  const [spec, setSpec] = useState<TemplateSpec>(initialSpec);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isSelectedQr, setIsSelectedQr] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<'select' | 'draw' | 'pan' | 'click_text'>(
    initialSpec.blocks.length === 0 ? 'click_text' : 'select'
  );
  const [ocrWords] = useState<OcrWord[]>(initialOcrWords);

  const [showFidelityModal, setShowFidelityModal] = useState<boolean>(false);
  const [showFigmaModal, setShowFigmaModal] = useState<boolean>(false);
  const [copiedFigmaJson, setCopiedFigmaJson] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [healthReport, setHealthReport] = useState<HealthCheckReport | null>(null);
  const [showHealthModal, setShowHealthModal] = useState<boolean>(false);

  const isFigmaConnected = Boolean(spec.figma?.fileKey);
  const figmaFileKey = spec.figma?.fileKey || null;

  // New Block Dialog State (from Click Text or Draw Box)
  const [pendingBlockCreation, setPendingBlockCreation] = useState<{
    rect: Rect;
    sourceRect: Rect;
    sourceText: string;
  } | null>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'textarea' | 'date' | 'select' | 'number'>('text');
  const [isRecipientName, setIsRecipientName] = useState(false);
  const [fieldSample, setFieldSample] = useState('');

  // Undo / Redo history stack
  const [history, setHistory] = useState<TemplateSpec[]>([initialSpec]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const pushState = (newSpec: TemplateSpec) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newSpec);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setSpec(newSpec);
    saveDraft(newSpec);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex((i) => i - 1);
      setSpec(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((i) => i + 1);
      setSpec(history[historyIndex + 1]);
    }
  };

  const selectedBlock = spec.blocks.find((b) => b.id === selectedBlockId) || null;

  const handleUpdateBlockRect = (id: string, rect: Rect) => {
    const updatedBlocks = spec.blocks.map((b) => (b.id === id ? { ...b, rect } : b));
    setSpec({ ...spec, blocks: updatedBlocks });
  };

  const handleUpdateQrRect = (rect: Rect) => {
    setSpec({ ...spec, qr: { ...spec.qr, rect } });
  };

  const handleAddBlock = (rect: Rect) => {
    setPendingBlockCreation({
      rect,
      sourceRect: { ...rect },
      sourceText: 'Sample Text',
    });
    setFieldLabel('New Field');
    setFieldKey(`field_${Date.now().toString(36).slice(-4)}`);
    setFieldType('text');
    setIsRecipientName(false);
    setFieldSample('Sample Text');
  };

  const handleWordClick = (word: OcrWord) => {
    const w = Math.max(12, word.bbox.x1 - word.bbox.x0);
    const h = Math.max(10, word.bbox.y1 - word.bbox.y0);
    const wordRect: Rect = {
      x: word.bbox.x0,
      y: word.bbox.y0,
      w,
      h,
    };

    const isName = /([A-Z]{3,}\s+[A-Z]{3,}|MR\.|MS\.|DR\.)/i.test(word.text);
    const autoLabel = isName ? 'Recipient Full Name' : word.text.replace(/[^a-zA-Z0-9]/g, ' ').trim();
    const autoKey = isName ? 'recipient_name' : autoLabel.toLowerCase().replace(/\s+/g, '_').slice(0, 25);

    setPendingBlockCreation({
      rect: wordRect,
      sourceRect: wordRect,
      sourceText: word.text,
    });
    setFieldLabel(autoLabel || 'New Field');
    setFieldKey(autoKey || `field_${Date.now().toString(36).slice(-4)}`);
    setFieldType('text');
    setIsRecipientName(isName);
    setFieldSample(word.text);
  };

  const handleConfirmCreateBlock = async () => {
    if (!pendingBlockCreation) return;

    let styleColor = '#FFFFFF';
    try {
      const pixelData = await getImagePixelData(originalImageDataUrl, spec.canvas.width, spec.canvas.height);
      styleColor = estimateTextColor(pixelData.data, spec.canvas.width, spec.canvas.height, pendingBlockCreation.sourceRect).textColor;
    } catch {
      // fallback
    }

    const newBlockId = `blk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newBlock: TemplateBlock = {
      id: newBlockId,
      rect: pendingBlockCreation.rect,
      sourceRect: pendingBlockCreation.sourceRect,
      sourceText: pendingBlockCreation.sourceText,
      text: `{{${fieldKey}}}`,
      role: isRecipientName ? 'variable' : 'variable',
      style: {
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: isRecipientName ? 700 : 600,
        fontSize: Math.max(14, Math.round(pendingBlockCreation.rect.h * 0.75)),
        color: styleColor,
        align: 'left',
        lineHeight: 1.2,
        letterSpacing: isRecipientName ? 1 : 0,
        transform: 'none',
        fit: 'shrink',
        maxLines: fieldType === 'textarea' ? 3 : 1,
      },
    };

    const newField: TemplateField = {
      key: fieldKey,
      label: fieldLabel,
      type: fieldType,
      required: true,
      sample: fieldSample,
      mapsTo: isRecipientName ? ('recipient_name' as FieldMapTarget) : undefined,
    };

    const newSpec: TemplateSpec = {
      ...spec,
      blocks: [...spec.blocks, newBlock],
      fields: [...spec.fields.filter((f) => f.key !== fieldKey), newField],
    };

    pushState(newSpec);
    setSelectedBlockId(newBlockId);
    setPendingBlockCreation(null);
    setActiveTool('select');
  };

  const handleDeleteSelected = () => {
    if (selectedBlockId) {
      const updatedBlocks = spec.blocks.filter((b) => b.id !== selectedBlockId);
      pushState({ ...spec, blocks: updatedBlocks });
      setSelectedBlockId(null);
    }
  };

  const handleUpdateBlock = (updated: TemplateBlock) => {
    const updatedBlocks = spec.blocks.map((b) => (b.id === updated.id ? updated : b));
    pushState({ ...spec, blocks: updatedBlocks });
  };

  const handleUpdateQr = (updatedQr: QrPlacement) => {
    pushState({ ...spec, qr: updatedQr });
  };

  const handleUpdateField = (updatedField: TemplateField) => {
    const updatedFields = spec.fields.map((f) => (f.key === updatedField.key ? updatedField : f));
    pushState({ ...spec, fields: updatedFields });
  };

  const handleAddField = (newField: TemplateField) => {
    if (!spec.fields.some((f) => f.key === newField.key)) {
      pushState({ ...spec, fields: [...spec.fields, newField] });
    }
  };

  // Perform background inpainting & save with Health Check enforcement
  const handleSaveAndApply = async () => {
    // 1. Run pure template health checks
    const checkReport = runTemplateHealthCheck(spec, {
      imageNaturalSize: { width: spec.canvas.width, height: spec.canvas.height },
    });

    if (!checkReport.passed) {
      setHealthReport(checkReport);
      setShowHealthModal(true);
      return;
    }

    setIsSaving(true);
    try {
      const pixelData = await getImagePixelData(
        originalImageDataUrl,
        spec.canvas.width,
        spec.canvas.height
      );

      // Collect variable rects to erase
      const eraseRects: Rect[] = [];
      spec.blocks.forEach((b) => {
        if (b.role === 'variable' || b.role === 'paragraph' || b.eraseOnly || b.role === 'erase_only') {
          eraseRects.push(b.sourceRect || b.rect);
        }
      });

      const inpaintResult = await inpaintRegionsAsync(
        pixelData.data,
        spec.canvas.width,
        spec.canvas.height,
        eraseRects
      );

      const erasedDataUrl = pixelDataToDataUrl(
        inpaintResult.data,
        spec.canvas.width,
        spec.canvas.height,
        'image/jpeg',
        0.92
      );

      const finalSpec: TemplateSpec = {
        ...spec,
        schema: 'certichain.template/v1',
        background: {
          mime: 'image/jpeg',
          dataUrl: erasedDataUrl,
          erasedBackground: true,
        },
      };

      await saveTemplate(finalSpec);
      onSave(finalSpec);
    } catch (err) {
      console.error('Failed to save template in studio:', err);
      alert('Error saving template: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col select-none overflow-hidden animate-in fade-in">
      {/* Manual Mode Notice Banner (Phase A2) */}
      {(manualModeNotice || spec.blocks.length === 0) && (
        <div className="bg-azure-900/90 border-b border-azure-700 px-4 py-2 text-center text-xs text-azure-100 font-medium flex items-center justify-center gap-2">
          <MousePointerClick className="w-4 h-4 text-azure-300" />
          <span>We could not detect editable text automatically. Click the text you want to make editable or draw a box over it.</span>
        </div>
      )}

      {/* Top Toolbar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between text-white gap-4 flex-shrink-0">
        {/* Left: Template Name Input */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-azure-600 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={spec.name}
              onChange={(e) => setSpec({ ...spec, name: e.target.value })}
              className="bg-slate-950 border border-slate-700 focus:border-azure-500 rounded-lg px-3 py-1 text-sm font-bold text-white focus:outline-none w-56 sm:w-64"
              placeholder="Template Name"
            />
            {isFigmaConnected && (
              <span
                title={figmaFileKey ? `Figma File: ${figmaFileKey}` : 'Figma Connected'}
                className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-950/80 border border-purple-700/80 text-purple-300 shadow-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span>Figma Synced</span>
              </span>
            )}
          </div>
        </div>

        {/* Center: Tool Selector & Actions */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTool('click_text')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'click_text'
                ? 'bg-azure-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Click Text to create anchored editable blocks"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>Click Text</span>
          </button>

          <button
            onClick={() => setActiveTool('select')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'select'
                ? 'bg-azure-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Select & Move"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Select</span>
          </button>

          <button
            onClick={() => setActiveTool('draw')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'draw'
                ? 'bg-azure-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Draw New Field Box"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Draw Box</span>
          </button>

          <button
            onClick={() => setActiveTool('pan')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'pan'
                ? 'bg-azure-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Pan Canvas"
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Pan</span>
          </button>

          <div className="w-[1px] h-4 bg-slate-800 mx-1" />

          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={historyIndex === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleRedo}
            disabled={historyIndex === history.length - 1}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Fidelity, Figma & Save Controls */}
        <div className="flex items-center gap-2">
          {/* Figma Integration Actions */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setShowFigmaModal(true)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-950/50 flex items-center gap-1.5 transition-colors"
              title="Import or re-sync from Figma URL"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z"/>
                <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z"/>
                <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z"/>
                <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z"/>
                <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z"/>
              </svg>
              <span className="hidden xl:inline">Figma</span>
            </button>

            <button
              onClick={() => {
                const json = exportTemplateToFigmaJson(spec);
                navigator.clipboard.writeText(json);
                setCopiedFigmaJson(true);
                setTimeout(() => setCopiedFigmaJson(false), 2000);
              }}
              className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              title="Copy Figma Template JSON Schema"
            >
              {copiedFigmaJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden xl:inline">{copiedFigmaJson ? 'Copied' : 'Schema'}</span>
            </button>
          </div>

          <button
            onClick={() => setShowFidelityModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Fidelity Check</span>
          </button>

          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-transparent hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSaveAndApply}
            disabled={isSaving}
            className="px-4 sm:px-5 py-2 rounded-xl text-xs font-bold text-white bg-azure-600 hover:bg-azure-500 shadow-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Inpainting...' : 'Use this template'}</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body: Canvas + Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Canvas */}
        <main className="flex-1 h-full relative overflow-hidden">
          <StudioCanvas
            backgroundImageUrl={originalImageDataUrl}
            canvasWidth={spec.canvas.width}
            canvasHeight={spec.canvas.height}
            blocks={spec.blocks}
            qr={spec.qr}
            selectedBlockId={selectedBlockId}
            isSelectedQr={isSelectedQr}
            activeTool={activeTool}
            ocrWords={ocrWords}
            onSelectBlock={(id) => {
              setSelectedBlockId(id);
              if (id) setIsSelectedQr(false);
            }}
            onSelectQr={(sel) => {
              setIsSelectedQr(sel);
              if (sel) setSelectedBlockId(null);
            }}
            onUpdateBlockRect={handleUpdateBlockRect}
            onUpdateQrRect={handleUpdateQrRect}
            onAddBlock={handleAddBlock}
            onWordClick={handleWordClick}
            onDeleteSelected={handleDeleteSelected}
          />
        </main>

        {/* Right: Inspector */}
        <aside className="h-full flex-shrink-0 hidden md:block">
          <BlockInspector
            selectedBlock={selectedBlock}
            selectedQr={isSelectedQr}
            qr={spec.qr}
            fields={spec.fields}
            onUpdateBlock={handleUpdateBlock}
            onUpdateQr={handleUpdateQr}
            onUpdateField={handleUpdateField}
            onAddField={handleAddField}
            isFigmaConnected={isFigmaConnected}
            onOpenFigmaModal={() => setShowFigmaModal(true)}
          />
        </aside>
      </div>

      {/* Field Creation Dialog Modal */}
      {pendingBlockCreation && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-azure-400" />
                <span>Create Anchored Field Block</span>
              </h3>
              <button
                onClick={() => setPendingBlockCreation(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Field Label</label>
                <input
                  type="text"
                  value={fieldLabel}
                  onChange={(e) => {
                    setFieldLabel(e.target.value);
                    if (!fieldKey || fieldKey.startsWith('field_')) {
                      setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 25));
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-azure-500"
                  placeholder="e.g. Recipient Full Name"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Field Key</label>
                <input
                  type="text"
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-azure-500"
                  placeholder="e.g. recipient_name"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="recipient_check"
                  checked={isRecipientName}
                  onChange={(e) => {
                    setIsRecipientName(e.target.checked);
                    if (e.target.checked) {
                      setFieldKey('recipient_name');
                      setFieldLabel('Recipient Full Name');
                    }
                  }}
                  className="w-4 h-4 rounded text-azure-600 bg-slate-900 border-slate-700 focus:ring-azure-500"
                />
                <label htmlFor="recipient_check" className="text-slate-200 cursor-pointer">
                  This is the Recipient's Name (mapsTo recipient_name)
                </label>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Sample Value</label>
                <input
                  type="text"
                  value={fieldSample}
                  onChange={(e) => setFieldSample(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-azure-500"
                  placeholder="Original text on certificate"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setPendingBlockCreation(null)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreateBlock}
                className="btn-primary text-xs px-4 py-1.5"
              >
                Add Field Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Health Check Blocking Modal */}
      {showHealthModal && healthReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-white">
            <div className="flex items-center gap-2 text-rose-400 border-b border-slate-800 pb-3">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-slate-100">Template Health Check Failed</h3>
            </div>
            <p className="text-xs text-slate-400">
              The template cannot be used until the following requirements are met:
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {healthReport.checks.map((check) => (
                <div
                  key={check.id}
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    check.passed
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800/50 text-rose-200'
                  }`}
                >
                  {check.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-bold">{check.name}</p>
                    <p className="text-[11px] opacity-80">{check.description}</p>
                    {check.error && <p className="text-[10px] text-rose-300 font-mono mt-1">{check.error}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowHealthModal(false)}
                className="btn-primary text-xs px-4 py-2"
              >
                Return to Studio to Fix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fidelity Check Modal */}
      {showFidelityModal && (
        <FidelityDiff
          spec={spec}
          originalImageDataUrl={originalImageDataUrl}
          sampleValues={{}}
          onClose={() => setShowFidelityModal(false)}
        />
      )}

      {/* Figma Import / Re-sync Modal */}
      <FigmaImportModal
        isOpen={showFigmaModal}
        onClose={() => setShowFigmaModal(false)}
        initialOcrSpec={spec}
        onTemplateReady={(newSpec) => {
          pushState(newSpec);
          setSpec(newSpec);
        }}
      />
    </div>
  );
};
