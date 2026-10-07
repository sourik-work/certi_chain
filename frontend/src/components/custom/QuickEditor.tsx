/**
 * Built-In Quick Editor Component
 * Zero-dependency, lightweight in-browser canvas editor with real-time typography adjustments,
 * box repositioning, alignment controls, color picking, and live schema synchronization.
 */

import React, { useState } from 'react';
import type { CertificateTemplate, TemplateField, NormalizedBox } from '../../types/customTemplate';
import { FieldCanvas } from './FieldCanvas';
import { FieldInspector } from './FieldInspector';
import { Edit3, Check, RotateCcw, X } from 'lucide-react';

interface QuickEditorProps {
  template: CertificateTemplate;
  onSave: (updatedTemplate: CertificateTemplate) => void;
  onClose: () => void;
}

export const QuickEditor: React.FC<QuickEditorProps> = ({
  template: initialTemplate,
  onSave,
  onClose,
}) => {
  const [template, setTemplate] = useState<CertificateTemplate>(initialTemplate);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(
    initialTemplate.fields[0]?.key || null
  );

  const handleUpdateFieldBox = (key: string, box: NormalizedBox) => {
    setTemplate((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.key === key ? { ...f, box } : f)),
    }));
  };

  const handleUpdateField = (updated: TemplateField) => {
    setTemplate((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.key === updated.key ? updated : f)),
    }));
  };

  const handleAddField = (box: NormalizedBox) => {
    const newIdx = template.fields.length + 1;
    const newKey = `field${newIdx}`;
    const newField: TemplateField = {
      key: newKey,
      label: `Field ${newIdx}`,
      type: 'text',
      required: true,
      box,
      style: {
        fontFamily: 'Plus Jakarta Sans',
        fontSize: Math.round(template.heightPx * 0.03),
        fontWeight: 600,
        color: '#1E293B',
        align: 'left',
        letterSpacing: 0,
        lineHeight: 1.2,
        minFontSize: 12,
        maxLines: 1,
        uppercase: false,
      },
      confidence: 1.0,
      source: 'issuer',
    };

    setTemplate((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
    setSelectedFieldKey(newKey);
  };

  const handleDeleteField = (key: string) => {
    setTemplate((prev) => ({
      ...prev,
      fields: prev.fields.filter((f) => f.key !== key),
    }));
    if (selectedFieldKey === key) {
      setSelectedFieldKey(null);
    }
  };

  const handleConfirmConfidence = (key: string) => {
    setTemplate((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.key === key ? { ...f, confidence: 1.0 } : f)),
    }));
  };

  const handleReset = () => {
    setTemplate(initialTemplate);
    setSelectedFieldKey(initialTemplate.fields[0]?.key || null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col justify-between overflow-hidden animate-in fade-in">
      {/* Top Header Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-azure-600 flex items-center justify-center shadow-md">
            <Edit3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-sm sm:text-base">Quick Editor</h2>
            <p className="text-[11px] text-slate-400">
              Customize typography, reposition text boxes, and add dynamic slots.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Original</span>
          </button>

          <button
            type="button"
            onClick={() => onSave(template)}
            className="btn-primary text-xs flex items-center gap-1.5 py-2"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save & Apply Changes</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Workspace: Canvas on Left, Inspector on Right */}
      <main className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 flex flex-col items-center">
          <FieldCanvas
            template={template}
            selectedFieldKey={selectedFieldKey}
            onSelectField={setSelectedFieldKey}
            onUpdateFieldBox={handleUpdateFieldBox}
            onAddField={handleAddField}
            onDeleteField={handleDeleteField}
            onConfirmConfidence={handleConfirmConfidence}
          />
        </div>

        <div className="lg:col-span-4">
          <FieldInspector
            fields={template.fields}
            selectedFieldKey={selectedFieldKey}
            onSelectField={setSelectedFieldKey}
            onUpdateField={handleUpdateField}
            onDeleteField={handleDeleteField}
            onConfirmConfidence={handleConfirmConfidence}
          />
        </div>
      </main>
    </div>
  );
};
