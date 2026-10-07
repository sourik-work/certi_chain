/**
 * Revision Timeline Component
 * Shows history of template iterations (Original Upload, AI Analysis, Canva/Figma edits, Quick edits)
 * and allows restoring previous revisions.
 */

import React from 'react';
import type { TemplateRevision } from '../../types/customTemplate';
import { History, Check, RotateCcw } from 'lucide-react';

interface RevisionTimelineProps {
  revisions: TemplateRevision[];
  activeRevisionId: string | null;
  onRestoreRevision: (id: string) => void;
}

export const RevisionTimeline: React.FC<RevisionTimelineProps> = ({
  revisions,
  activeRevisionId,
  onRestoreRevision,
}) => {
  if (revisions.length <= 1) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-navy-950 dark:text-white font-bold text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
        <History className="w-4 h-4 text-azure-600" />
        <span>Template Revision History</span>
      </div>

      <div className="space-y-2">
        {revisions.map((rev, idx) => {
          const isActive = rev.id === activeRevisionId;
          const time = new Date(rev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div
              key={rev.id}
              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                isActive
                  ? 'border-azure-500 bg-azure-50/70 dark:bg-azure-950/40 text-azure-950 dark:text-azure-200 font-semibold'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-navy-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                  {revisions.length - idx}
                </div>
                <div>
                  <div className="font-bold truncate max-w-[160px] sm:max-w-xs">{rev.title}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {rev.source} • {time}
                  </div>
                </div>
              </div>

              {isActive ? (
                <span className="flex items-center gap-1 text-[11px] text-azure-600 font-bold px-2 py-0.5 rounded-full bg-azure-100 dark:bg-azure-900/60">
                  <Check className="w-3 h-3" /> Active
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onRestoreRevision(rev.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-navy-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Restore this revision"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
