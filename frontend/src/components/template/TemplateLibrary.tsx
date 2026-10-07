import React, { useState, useEffect, useRef } from 'react';
import { TemplateSpec, TemplateStorageItem } from '../../lib/template/types';
import {
  listTemplates,
  deleteTemplate,
  clearAllTemplates,
  saveTemplate,
  exportTemplateToFile,
  importTemplateFromFile,
} from '../../lib/template/store';
import {
  LayoutTemplate,
  Edit3,
  Copy,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  FolderOpen,
  Plus,
} from 'lucide-react';

interface TemplateLibraryProps {
  activeTemplateId?: string | null;
  onSelectTemplate: (spec: TemplateSpec) => void;
  onEditTemplate: (spec: TemplateSpec) => void;
  onUploadNew: () => void;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  activeTemplateId,
  onSelectTemplate,
  onEditTemplate,
  onUploadNew,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<TemplateStorageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const items = await listTemplates();
      setTemplates(items);
    } catch (err) {
      console.warn('Failed to load templates from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete template "${name}"?`)) {
      await deleteTemplate(id);
      await loadTemplates();
    }
  };

  const handleDuplicate = async (spec: TemplateSpec) => {
    const duplicated: TemplateSpec = {
      ...spec,
      id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${spec.name} (Copy)`,
      createdAt: new Date().toISOString(),
    };
    await saveTemplate(duplicated);
    await loadTemplates();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imported = await importTemplateFromFile(file);
      await loadTemplates();
      onSelectTemplate(imported);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import template JSON');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-azure-600 dark:text-azure-400" />
          <h3 className="font-bold text-sm text-navy-950 dark:text-slate-100">
            My Template Library
          </h3>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
            {templates.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.certichain-template.json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5"
            title="Import .certichain-template.json file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
          </button>

          {templates.length > 0 && (
            <button
              onClick={async () => {
                if (confirm('Delete all saved templates from this browser? This action cannot be undone.')) {
                  await clearAllTemplates();
                  await loadTemplates();
                }
              }}
              className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/50"
              title="Delete all saved templates"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All</span>
            </button>
          )}

          <button
            onClick={onUploadNew}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload New</span>
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-xs text-slate-500">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-6 bg-slate-50/50 dark:bg-slate-900/30">
          <LayoutTemplate className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No Custom Templates Saved
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Upload a certificate image to automatically detect fields and build your first custom template.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {templates.map((item) => {
            const isActive = activeTemplateId === item.id;

            return (
              <div
                key={item.id}
                className={`group relative rounded-2xl border p-3.5 transition-all bg-white dark:bg-slate-900 ${
                  isActive
                    ? 'border-azure-500 ring-2 ring-azure-500/20 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 mb-3">
                  <img
                    src={item.thumbnailDataUrl || item.spec.background.dataUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  {isActive && (
                    <div className="absolute top-2 right-2 bg-azure-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Active</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-1 mb-3">
                  <h4 className="font-bold text-xs text-navy-950 dark:text-slate-100 truncate">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {item.spec.fields.length} variable fields •{' '}
                    {new Date(item.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 gap-1.5">
                  <button
                    onClick={() => onSelectTemplate(item.spec)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 transition-colors ${
                      isActive
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-azure-600 hover:bg-azure-500 text-white'
                    }`}
                  >
                    {isActive ? 'In Use' : 'Use Template'}
                  </button>

                  <button
                    onClick={() => onEditTemplate(item.spec)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit in Studio"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDuplicate(item.spec)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Duplicate Template"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => exportTemplateToFile(item.spec)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Export .certichain-template.json"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(item.id, item.name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
