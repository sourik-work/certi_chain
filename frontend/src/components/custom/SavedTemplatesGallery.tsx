/**
 * Saved Templates Gallery Component
 * Renders a rich, searchable visual gallery of saved custom certificate templates,
 * allowing issuers to launch one-click issuance or customize existing layouts.
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { CertificateTemplate } from '../../types/customTemplate';
import {
  SavedCustomTemplate,
  getSavedCustomTemplates,
  deleteSavedCustomTemplate,
  renameSavedCustomTemplate,
} from '../../lib/savedTemplatesStore';
import {
  Bookmark,
  Search,
  Sparkles,
  Send,
  Edit3,
  Trash2,
  Layers,
  Check,
  X,
  Plus,
  QrCode,
  FileCheck,
} from 'lucide-react';

interface SavedTemplatesGalleryProps {
  onSelectTemplateForIssuance: (
    template: CertificateTemplate,
    initialValues?: Record<string, string>,
    recipientWallet?: string
  ) => void;
  onSelectTemplateForEditing: (template: CertificateTemplate) => void;
  onCreateNewTemplate: () => void;
}

export const SavedTemplatesGallery: React.FC<SavedTemplatesGalleryProps> = ({
  onSelectTemplateForIssuance,
  onSelectTemplateForEditing,
  onCreateNewTemplate,
}) => {
  const [templates, setTemplates] = useState<SavedCustomTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [newTitleValue, setNewTitleValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const refreshTemplates = () => {
    setTemplates(getSavedCustomTemplates());
  };

  useEffect(() => {
    refreshTemplates();
  }, []);

  // Filter templates based on search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase().trim();
    return templates.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchHash = item.template.templateHash.toLowerCase().includes(q);
      const matchFields = item.template.fields.some(
        (f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
      );
      return matchTitle || matchHash || matchFields;
    });
  }, [templates, searchQuery]);

  const handleStartRename = (item: SavedCustomTemplate) => {
    setEditingTitleId(item.id);
    setNewTitleValue(item.title);
  };

  const handleSaveRename = (id: string) => {
    if (newTitleValue.trim()) {
      renameSavedCustomTemplate(id, newTitleValue.trim());
      refreshTemplates();
    }
    setEditingTitleId(null);
  };

  const handleDelete = (id: string) => {
    deleteSavedCustomTemplate(id);
    setDeleteConfirmId(null);
    refreshTemplates();
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Controls & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Bookmark className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-serif font-bold text-navy-950 dark:text-white">
                Saved Certificate Templates
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select any previously issued custom certificate template to immediately issue new credentials.
            </p>
          </div>

          <button
            type="button"
            onClick={onCreateNewTemplate}
            className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Upload New Template</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by title, variable fields (e.g. Recipient, Date), or hash..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl pl-10 pr-10 py-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-azure-500 transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Templates Grid / Empty State */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-card space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-azure-50 dark:bg-azure-900/30 text-azure-600 dark:text-azure-400 flex items-center justify-center mx-auto">
            <Bookmark className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-serif font-bold text-navy-950 dark:text-white">
              {searchQuery ? 'No matching templates found' : 'No Saved Templates Yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {searchQuery
                ? `No templates match "${searchQuery}". Try a different search term or clear the filter.`
                : 'Whenever you issue a certificate in the Custom Certificate tab, the template is automatically saved here for quick, repeatable issuance.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateNewTemplate}
            className="btn-primary py-2.5 px-5 text-xs font-bold inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create & Issue Custom Certificate</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((item) => {
            const hasQr = item.template.fields.some((f) => f.type === 'qrCode');
            const variableCount = item.template.fields.filter(
              (f) => !['qrCode', 'certId', 'proofHash'].includes(f.type)
            ).length;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-card hover:shadow-xl transition-all duration-300 flex flex-col group"
              >
                {/* Visual Thumbnail Area */}
                <div className="relative bg-slate-950/5 dark:bg-slate-950 aspect-[16/10] overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-slate-800">
                  {item.thumbnailUrl || item.template.previewDataUrl || item.template.cleanedBaseDataUrl ? (
                    <img
                      src={item.thumbnailUrl || item.template.previewDataUrl || item.template.cleanedBaseDataUrl}
                      alt={item.title}
                      className="w-full h-full object-contain p-2 group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Layers className="w-8 h-8" />
                      <span className="text-[11px]">Certificate Template</span>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-1 bg-navy-950/80 backdrop-blur-md text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">
                      {item.template.orientation}
                    </span>
                    {item.issueCount > 0 && (
                      <span className="px-2 py-1 bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm">
                        <FileCheck className="w-3 h-3" />
                        <span>Issued {item.issueCount}×</span>
                      </span>
                    )}
                  </div>

                  {hasQr && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-navy-950 dark:text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm">
                      <QrCode className="w-3 h-3 text-azure-500" />
                      <span>Dynamic QR</span>
                    </div>
                  )}
                </div>

                {/* Body Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    {/* Title & Rename */}
                    {editingTitleId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newTitleValue}
                          onChange={(e) => setNewTitleValue(e.target.value)}
                          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-azure-500 rounded-lg px-2.5 py-1 text-xs font-bold text-navy-950 dark:text-white focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(item.id);
                            if (e.key === 'Escape') setEditingTitleId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(item.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTitleId(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif font-bold text-sm text-navy-950 dark:text-white line-clamp-2 leading-snug">
                          {item.title}
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleStartRename(item)}
                          className="text-slate-400 hover:text-azure-600 dark:hover:text-azure-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Rename Template"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Meta info: Fields & Dimensions */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-mono">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {variableCount} variable fields
                      </span>
                      <span>•</span>
                      <span className="font-mono">
                        {item.template.widthPx} × {item.template.heightPx} px
                      </span>
                    </div>

                    {/* Detected variable chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.template.fields
                        .filter((f) => !['qrCode', 'certId', 'proofHash'].includes(f.type))
                        .slice(0, 4)
                        .map((f) => (
                          <span
                            key={f.key}
                            className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] rounded-md font-medium"
                          >
                            {f.label}
                          </span>
                        ))}
                      {item.template.fields.filter(
                        (f) => !['qrCode', 'certId', 'proofHash'].includes(f.type)
                      ).length > 4 && (
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] rounded-md font-mono">
                          +
                          {item.template.fields.filter(
                            (f) => !['qrCode', 'certId', 'proofHash'].includes(f.type)
                          ).length - 4}{' '}
                          more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectTemplateForIssuance(
                          item.template,
                          item.lastValues,
                          item.lastRecipientWallet
                        )
                      }
                      className="w-full btn-primary py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Use Template & Issue</span>
                    </button>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectTemplateForEditing(item.template)}
                        className="text-[11px] font-bold text-azure-600 dark:text-azure-400 hover:text-azure-700 dark:hover:text-azure-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-azure-50 dark:hover:bg-azure-950/30 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Layout / Fields</span>
                      </button>

                      {deleteConfirmId === item.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded hover:bg-rose-700 transition-colors"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="text-[11px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          title="Delete Template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
