import { useState, useRef } from 'react';
import { TemplateBlock, TemplateField, TextStyle, QrPlacement, FieldMapTarget } from '../../lib/template/types';
import { WHITELISTED_FONTS } from '../../lib/template/fonts';
import { extractTokens } from '../../lib/template/tokens';
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Layers,
  Sparkles,
  QrCode,
  Tag,
  X,
  ArrowRight,
} from 'lucide-react';

interface BlockInspectorProps {
  selectedBlock: TemplateBlock | null;
  selectedQr: boolean;
  qr: QrPlacement;
  fields: TemplateField[];
  onUpdateBlock: (updated: TemplateBlock) => void;
  onUpdateQr: (updated: QrPlacement) => void;
  onUpdateField?: (updated: TemplateField) => void;
  onAddField: (newField: TemplateField) => void;
  isFigmaConnected?: boolean;
  onOpenFigmaModal?: () => void;
}

export const BlockInspector: React.FC<BlockInspectorProps> = ({
  selectedBlock,
  selectedQr,
  qr,
  fields,
  onUpdateBlock,
  onUpdateQr,
  onAddField,
  isFigmaConnected = false,
  onOpenFigmaModal,
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [isFigmaBannerDismissed, setIsFigmaBannerDismissed] = useState(false);
  const [selectedSubstr, setSelectedSubstr] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<'text' | 'textarea' | 'date' | 'number' | 'select'>('text');
  const [newMapsTo, setNewMapsTo] = useState<FieldMapTarget>('custom');

  if (selectedQr) {
    return (
      <div className="w-80 h-full bg-slate-900 border-l border-slate-800 p-5 text-white overflow-y-auto space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <QrCode className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">
            QR Code Settings
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Caption Label
            </label>
            <input
              type="text"
              value={qr.caption}
              onChange={(e) => onUpdateQr({ ...qr, caption: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="e.g. Scan to verify"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs font-medium text-slate-200">White Background Tile</span>
              <p className="text-[10px] text-slate-400">Enhances QR scanner contrast</p>
            </div>
            <input
              type="checkbox"
              checked={qr.tile}
              onChange={(e) => onUpdateQr({ ...qr, tile: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
            />
          </div>

          <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-300">
            <p className="font-semibold mb-1">On-Chain Scannable</p>
            <p className="text-[11px] text-emerald-400/80">
              The QR code always encodes the tamper-evident certificate URL for instant on-chain verification.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedBlock) {
    return (
      <div className="w-80 h-full bg-slate-900 border-l border-slate-800 p-6 text-white flex flex-col items-center justify-center text-center">
        <Layers className="w-10 h-10 text-slate-600 mb-3" />
        <h4 className="text-sm font-semibold text-slate-300">No Element Selected</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
          Click on any text block on the canvas or draw a new box to customize its properties.
        </p>
      </div>
    );
  }

  const updateStyle = (patch: Partial<TextStyle>) => {
    onUpdateBlock({
      ...selectedBlock,
      style: { ...selectedBlock.style, ...patch },
    });
  };

  const handleMakeSelectionAField = () => {
    if (!textAreaRef.current) return;
    const start = textAreaRef.current.selectionStart;
    const end = textAreaRef.current.selectionEnd;
    const substr = selectedBlock.text.substring(start, end).trim();

    if (!substr) {
      alert('Please highlight a substring of text in the box above first.');
      return;
    }

    setSelectedSubstr(substr);
    const suggestedKey = substr
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'field_key';
    setNewKey(suggestedKey);
    setNewLabel(substr);
    setShowTokenModal(true);
  };

  const handleConfirmWrapField = () => {
    if (!newKey || !/^[a-z][a-z0-9_]{0,39}$/.test(newKey)) {
      alert('Key must start with a letter and contain only lowercase letters, numbers, and underscores.');
      return;
    }

    const updatedText = selectedBlock.text.replace(selectedSubstr, `{{${newKey}}}`);

    if (!fields.some((f) => f.key === newKey)) {
      onAddField({
        key: newKey,
        label: newLabel || newKey,
        type: newType,
        required: true,
        sample: selectedSubstr,
        mapsTo: newMapsTo,
      });
    }

    onUpdateBlock({
      ...selectedBlock,
      text: updatedText,
      role: 'paragraph',
    });

    setShowTokenModal(false);
  };

  const tokens = extractTokens(selectedBlock.text);

  return (
    <div className="w-80 h-full bg-slate-900 border-l border-slate-800 p-5 text-white overflow-y-auto space-y-6 select-none">
      {/* Block Header & Role Selector */}
      <div className="space-y-3 border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400 font-semibold uppercase">
            Block ID: {selectedBlock.id.slice(0, 12)}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              selectedBlock.role === 'variable' || selectedBlock.role === 'paragraph'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : selectedBlock.eraseOnly
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            {selectedBlock.role || 'Fixed'}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Block Role</label>
          <select
            value={selectedBlock.role || 'fixed'}
            onChange={(e) => {
              const role = e.target.value as 'fixed' | 'variable' | 'paragraph' | 'erase_only';
              onUpdateBlock({
                ...selectedBlock,
                role,
                eraseOnly: role === 'erase_only',
              });
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-azure-500 focus:outline-none"
          >
            <option value="fixed">Fixed (Keep in background untouched)</option>
            <option value="variable">Variable Field (Erased & Replaced)</option>
            <option value="paragraph">Paragraph with Fields (Template)</option>
            <option value="erase_only">Erase Region Only (Blank out)</option>
          </select>
        </div>
      </div>

      {/* Connect to Figma Suggestion Banner */}
      {!isFigmaConnected && !isFigmaBannerDismissed && onOpenFigmaModal && (
        <div className="bg-gradient-to-r from-purple-950/70 to-indigo-950/70 border border-purple-800/80 rounded-2xl p-3.5 space-y-2 relative animate-in fade-in">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 fill-purple-400 shrink-0" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z"/>
                <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z"/>
                <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z"/>
                <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z"/>
                <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z"/>
              </svg>
              <span className="font-bold text-purple-200 text-xs">Figma Layer Sync</span>
            </div>
            <button
              onClick={() => setIsFigmaBannerDismissed(true)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
              title="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-purple-300/80 leading-relaxed">
            Connect to Figma to sync layers and typography.
          </p>
          <button
            type="button"
            onClick={onOpenFigmaModal}
            className="w-full py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <span>Connect to Figma</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Text Editor & Token Tools */}
      {!selectedBlock.eraseOnly && (
        <div className="space-y-3 border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">Block Template Text</label>
            <button
              onClick={handleMakeSelectionAField}
              className="text-[11px] text-azure-400 hover:text-azure-300 font-medium flex items-center gap-1 bg-azure-500/10 hover:bg-azure-500/20 px-2 py-1 rounded-md border border-azure-500/30 transition-colors"
              title="Highlight words and convert them into a dynamic form field"
            >
              <Sparkles className="w-3 h-3" />
              <span>Make Field</span>
            </button>
          </div>

          <textarea
            ref={textAreaRef}
            rows={3}
            value={selectedBlock.text}
            onChange={(e) => onUpdateBlock({ ...selectedBlock, text: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:ring-2 focus:ring-azure-500 focus:outline-none resize-none leading-relaxed"
            placeholder="e.g. This is to certify that {{recipient_name}} completed {{event_name}}"
          />

          {/* Extracted Tokens List */}
          {tokens.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Tag className="w-3 h-3 text-azure-400" /> Embedded Variable Tokens:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tokens.map((t) => {
                  const field = fields.find((f) => f.key === t.key);
                  return (
                    <span
                      key={t.key}
                      className="bg-blue-950/60 border border-blue-700/60 text-blue-200 px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1"
                    >
                      <span className="font-bold">{`{{${t.key}}}`}</span>
                      {field && <span className="text-[9px] text-blue-400">({field.label})</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Typography Controls */}
      {!selectedBlock.eraseOnly && (
        <div className="space-y-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Type className="w-4 h-4 text-azure-400" />
            <span>Typography</span>
          </div>

          {/* Font Family & Weight */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Font Family</label>
              <select
                value={selectedBlock.style.fontFamily}
                onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {WHITELISTED_FONTS.map((font) => (
                  <option key={font.family} value={font.family}>
                    {font.family}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Font Weight</label>
              <select
                value={selectedBlock.style.fontWeight}
                onChange={(e) => updateStyle({ fontWeight: Number(e.target.value) as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value={300}>300 - Light</option>
                <option value={400}>400 - Regular</option>
                <option value={500}>500 - Medium</option>
                <option value={600}>600 - SemiBold</option>
                <option value={700}>700 - Bold</option>
                <option value={800}>800 - ExtraBold</option>
              </select>
            </div>
          </div>

          {/* Font Size & Color */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Size (px)</label>
              <input
                type="number"
                min={8}
                max={150}
                value={selectedBlock.style.fontSize}
                onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Text Color</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={selectedBlock.style.color}
                  onChange={(e) => updateStyle({ color: e.target.value.toUpperCase() })}
                  className="w-8 h-7 rounded border border-slate-700 bg-slate-950 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={selectedBlock.style.color}
                  onChange={(e) => updateStyle({ color: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono uppercase focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Alignment */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Alignment</label>
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['left', 'center', 'right', 'justify'] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => updateStyle({ align })}
                  className={`py-1 rounded flex items-center justify-center transition-colors ${
                    selectedBlock.style.align === align
                      ? 'bg-azure-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                  {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                  {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                  {align === 'justify' && <AlignJustify className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Line Height & Letter Spacing */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Line Height</label>
              <input
                type="number"
                step="0.1"
                min="0.8"
                max="3.0"
                value={selectedBlock.style.lineHeight}
                onChange={(e) => updateStyle({ lineHeight: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Letter Spacing (px)</label>
              <input
                type="number"
                step="0.5"
                min="-2"
                max="10"
                value={selectedBlock.style.letterSpacing}
                onChange={(e) => updateStyle({ letterSpacing: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal for Wrapping Highlighted Text as Field */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sparkles className="w-5 h-5 text-azure-400" />
              <h3 className="font-bold text-sm text-white">Create Variable Field</h3>
            </div>

            <p className="text-xs text-slate-400">
              Selected Text:{' '}
              <strong className="text-azure-300 font-mono">"{selectedSubstr}"</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Field Key (snake_case)
                </label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:ring-2 focus:ring-azure-500 focus:outline-none"
                  placeholder="e.g. recipient_name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Form Field Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-azure-500 focus:outline-none"
                  placeholder="e.g. Recipient Full Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Input Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="text">Single Line Text</option>
                    <option value="textarea">Multi-line Text</option>
                    <option value="date">Calendar Date</option>
                    <option value="number">Number</option>
                    <option value="select">Dropdown Select</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Maps To Standard
                  </label>
                  <select
                    value={newMapsTo}
                    onChange={(e) => setNewMapsTo(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="recipient_name">Recipient Name</option>
                    <option value="credential_title">Credential Title</option>
                    <option value="description">Description</option>
                    <option value="issue_date">Issue Date</option>
                    <option value="certificate_number">Certificate Number</option>
                    <option value="custom">Custom Field</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowTokenModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWrapField}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-azure-600 hover:bg-azure-500 shadow-md transition-colors"
              >
                Insert Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
