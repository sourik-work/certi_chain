/**
 * Field Inspector Component
 * Sidebar panel to inspect, edit, rename, retype, and style detected template fields.
 */

import React from 'react';
import type { TemplateField, FieldType } from '../../types/customTemplate';
import { ALLOWED_FONT_FAMILIES } from '../../lib/templateAnalysis';
import { Trash2, CheckCircle2, Sliders, Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface FieldInspectorProps {
  fields: TemplateField[];
  selectedFieldKey: string | null;
  onSelectField: (key: string | null) => void;
  onUpdateField: (updated: TemplateField) => void;
  onDeleteField: (key: string) => void;
  onConfirmConfidence: (key: string) => void;
}

const FIELD_TYPES: Array<{ type: FieldType; label: string }> = [
  { type: 'name', label: 'Recipient Name' },
  { type: 'text', label: 'Single-line Text' },
  { type: 'longText', label: 'Multi-line Paragraph' },
  { type: 'date', label: 'Date of Issue / Expiry' },
  { type: 'number', label: 'Number / Score' },
  { type: 'email', label: 'Email Address' },
  { type: 'walletAddress', label: 'Ethereum Wallet Address' },
  { type: 'select', label: 'Dropdown Selection' },
  { type: 'signature', label: 'Signatory Name / Signature' },
  { type: 'logo', label: 'Organization Logo' },
  { type: 'qrCode', label: 'Verification QR Code Slot' },
  { type: 'certId', label: 'Certificate ID Slot' },
  { type: 'proofHash', label: 'Proof Hash Slot' },
];

export const FieldInspector: React.FC<FieldInspectorProps> = ({
  fields,
  selectedFieldKey,
  onSelectField,
  onUpdateField,
  onDeleteField,
  onConfirmConfidence,
}) => {
  const selectedField = fields.find((f) => f.key === selectedFieldKey) || null;

  return (
    <div className="space-y-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-navy-950 dark:text-white font-bold text-sm">
          <Sliders className="w-4 h-4 text-azure-600" />
          <span>Field Inspector</span>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {fields.length} {fields.length === 1 ? 'field' : 'fields'} detected
        </span>
      </div>

      {/* Field List Selector */}
      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
        {fields.map((f) => {
          const isSelected = f.key === selectedFieldKey;
          const isLowConf = f.confidence < 0.7;

          return (
            <div
              key={f.key}
              onClick={() => onSelectField(f.key)}
              className={`p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                isSelected
                  ? 'border-azure-500 bg-azure-50/70 dark:bg-azure-950/40 text-azure-950 dark:text-azure-200 font-bold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className={`w-2 h-2 rounded-full ${isLowConf ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className="truncate">{f.label}</span>
                <span className="text-[10px] text-slate-400 font-mono">({f.key})</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isLowConf && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                    Review
                  </span>
                )}
                <span className="text-[10px] text-slate-400 uppercase font-mono">{f.type}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Field Editor Details */}
      {selectedField ? (
        <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          {selectedField.confidence < 0.7 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
              <span className="font-medium">Low AI Confidence ({(selectedField.confidence * 100).toFixed(0)}%)</span>
              <button
                type="button"
                onClick={() => onConfirmConfidence(selectedField.key)}
                className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 shadow-sm flex items-center gap-1 text-[11px]"
              >
                <CheckCircle2 className="w-3 h-3" /> Confirm
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
              Field Label
            </label>
            <input
              type="text"
              value={selectedField.label}
              onChange={(e) => onUpdateField({ ...selectedField, label: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-azure-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
                Field Key (camelCase)
              </label>
              <input
                type="text"
                value={selectedField.key}
                onChange={(e) => onUpdateField({ ...selectedField, key: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-azure-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
                Data Type
              </label>
              <select
                value={selectedField.type}
                onChange={(e) => onUpdateField({ ...selectedField, type: e.target.value as FieldType })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-azure-500"
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft.type} value={ft.type}>
                    {ft.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Typography Styling Controls */}
          {selectedField.style && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-3 border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center gap-1.5 text-xs font-bold text-navy-950 dark:text-slate-200">
                <Type className="w-3.5 h-3.5 text-azure-600" />
                <span>Typography & Appearance</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Font Family</label>
                  <select
                    value={selectedField.style.fontFamily}
                    onChange={(e) =>
                      onUpdateField({
                        ...selectedField,
                        style: { ...selectedField.style!, fontFamily: e.target.value },
                      })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                  >
                    {ALLOWED_FONT_FAMILIES.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Text Color</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={selectedField.style.color}
                      onChange={(e) =>
                        onUpdateField({
                          ...selectedField,
                          style: { ...selectedField.style!, color: e.target.value },
                        })
                      }
                      className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={selectedField.style.color}
                      onChange={(e) =>
                        onUpdateField({
                          ...selectedField,
                          style: { ...selectedField.style!, color: e.target.value },
                        })
                      }
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Alignment Buttons */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">Text Align</span>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateField({
                        ...selectedField,
                        style: { ...selectedField.style!, align: 'left' },
                      })
                    }
                    className={`p-1 rounded ${
                      selectedField.style.align === 'left' ? 'bg-azure-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateField({
                        ...selectedField,
                        style: { ...selectedField.style!, align: 'center' },
                      })
                    }
                    className={`p-1 rounded ${
                      selectedField.style.align === 'center' ? 'bg-azure-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateField({
                        ...selectedField,
                        style: { ...selectedField.style!, align: 'right' },
                      })
                    }
                    className={`p-1 rounded ${
                      selectedField.style.align === 'right' ? 'bg-azure-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* QR Code Special Controls */}
          {selectedField.type === 'qrCode' && (
            <div className="p-3.5 bg-azure-50/70 dark:bg-azure-950/40 border border-azure-200 dark:border-azure-800 rounded-xl space-y-3 text-xs">
              <div>
                <span className="font-bold text-azure-950 dark:text-azure-200 block mb-1">
                  QR Code Size & Scale:
                </span>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedField.box || { x: 0.84, y: 0.78, w: 0.08, h: 0.11 };
                      onUpdateField({
                        ...selectedField,
                        box: { ...cur, w: 0.08, h: 0.11 },
                      });
                    }}
                    className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-azure-300 dark:border-azure-700 rounded-lg text-[10px] font-semibold hover:border-azure-500 text-center"
                  >
                    Small (8%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedField.box || { x: 0.84, y: 0.78, w: 0.10, h: 0.14 };
                      onUpdateField({
                        ...selectedField,
                        box: { ...cur, w: 0.10, h: 0.14 },
                      });
                    }}
                    className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-azure-300 dark:border-azure-700 rounded-lg text-[10px] font-semibold hover:border-azure-500 text-center"
                  >
                    Compact (10%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedField.box || { x: 0.80, y: 0.74, w: 0.13, h: 0.18 };
                      onUpdateField({
                        ...selectedField,
                        box: { ...cur, w: 0.13, h: 0.18 },
                      });
                    }}
                    className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-azure-300 dark:border-azure-700 rounded-lg text-[10px] font-semibold hover:border-azure-500 text-center"
                  >
                    Medium (13%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedField.box || { x: 0.76, y: 0.70, w: 0.16, h: 0.22 };
                      onUpdateField({
                        ...selectedField,
                        box: { ...cur, w: 0.16, h: 0.22 },
                      });
                    }}
                    className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-azure-300 dark:border-azure-700 rounded-lg text-[10px] font-semibold hover:border-azure-500 text-center"
                  >
                    Large (16%)
                  </button>
                </div>

                {/* Size Sliders */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span>Width: {Math.round((selectedField.box?.w || 0.10) * 100)}%</span>
                    <span>Height: {Math.round((selectedField.box?.h || 0.14) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.28"
                    step="0.005"
                    value={selectedField.box?.w || 0.10}
                    onChange={(e) => {
                      const newW = parseFloat(e.target.value);
                      const cur = selectedField.box || { x: 0.84, y: 0.78, w: 0.10, h: 0.14 };
                      const newH = newW * 1.38; // maintain proportions
                      onUpdateField({
                        ...selectedField,
                        box: {
                          ...cur,
                          w: Math.round(newW * 1000) / 1000,
                          h: Math.round(Math.min(1 - cur.y, newH) * 1000) / 1000,
                        },
                      });
                    }}
                    className="w-full accent-azure-600 h-1.5 bg-azure-200 dark:bg-azure-900 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <span className="font-bold text-azure-950 dark:text-azure-200 block mb-1">
                  QR Placement Presets:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const w = selectedField.box?.w || 0.10;
                      const h = selectedField.box?.h || 0.14;
                      onUpdateField({
                        ...selectedField,
                        box: { x: Math.round((1 - w - 0.05) * 1000) / 1000, y: Math.round((1 - h - 0.06) * 1000) / 1000, w, h },
                      });
                    }}
                    className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-azure-300 dark:border-azure-700 rounded-lg text-[10px] font-medium hover:border-azure-500 text-center"
                  >
                    ↘ Bottom-Right
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const w = selectedField.box?.w || 0.10;
                      const h = selectedField.box?.h || 0.14;
                      onUpdateField({
                        ...selectedField,
                        box: { x: 0.05, y: Math.round((1 - h - 0.06) * 1000) / 1000, w, h },
                      });
                    }}
                    className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-azure-300 dark:border-azure-700 rounded-lg text-[10px] font-medium hover:border-azure-500 text-center"
                  >
                    ↙ Bottom-Left
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const w = selectedField.box?.w || 0.10;
                      const h = selectedField.box?.h || 0.14;
                      onUpdateField({
                        ...selectedField,
                        box: { x: Math.round(((1 - w) / 2) * 1000) / 1000, y: Math.round((1 - h - 0.06) * 1000) / 1000, w, h },
                      });
                    }}
                    className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-azure-300 dark:border-azure-700 rounded-lg text-[10px] font-medium hover:border-azure-500 text-center"
                  >
                    ↓ Bottom-Center
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const w = selectedField.box?.w || 0.10;
                      const h = selectedField.box?.h || 0.14;
                      onUpdateField({
                        ...selectedField,
                        box: { x: Math.round((1 - w - 0.05) * 1000) / 1000, y: 0.06, w, h },
                      });
                    }}
                    className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-azure-300 dark:border-azure-700 rounded-lg text-[10px] font-medium hover:border-azure-500 text-center"
                  >
                    ↗ Top-Right
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const w = selectedField.box?.w || 0.10;
                      const h = selectedField.box?.h || 0.14;
                      onUpdateField({
                        ...selectedField,
                        box: { x: 0.05, y: 0.06, w, h },
                      });
                    }}
                    className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-azure-300 dark:border-azure-700 rounded-lg text-[10px] font-medium hover:border-azure-500 text-center"
                  >
                    ↖ Top-Left
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const w = selectedField.box?.w || 0.10;
                      const h = selectedField.box?.h || 0.14;
                      onUpdateField({
                        ...selectedField,
                        box: { x: Math.round(((1 - w) / 2) * 1000) / 1000, y: Math.round(((1 - h) / 2) * 1000) / 1000, w, h },
                      });
                    }}
                    className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-azure-300 dark:border-azure-700 rounded-lg text-[10px] font-medium hover:border-azure-500 text-center"
                  >
                    ⏺ Center
                  </button>
                </div>
              </div>

              {/* Free drag & positioning hint */}
              <div className="text-[11px] text-azure-700 dark:text-azure-300 flex items-center gap-1 pt-1 border-t border-azure-200 dark:border-azure-800/60">
                <span>💡 You can also drag the QR box directly anywhere on the canvas or drag its corner handles to resize!</span>
              </div>
            </div>
          )}

          {/* Delete Action (Blocked for mandatory qrCode) */}
          <div className="pt-2 flex justify-end">
            {selectedField.type === 'qrCode' ? (
              <span className="text-[11px] font-medium text-slate-400 italic">
                🔒 Mandatory verification QR code cannot be deleted.
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onDeleteField(selectedField.key)}
                className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Field</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-slate-400 text-xs">
          Select a field on the canvas or from the list above to edit properties and typography.
        </div>
      )}
    </div>
  );
};
