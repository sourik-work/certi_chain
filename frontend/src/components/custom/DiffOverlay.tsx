/**
 * Diff Overlay Component
 * Visualizes layout differences before and after external editing (Canva / Figma).
 * Shows previous bounding boxes (red/dotted) vs new bounding boxes (green/solid).
 */

import React from 'react';
import type { CertificateTemplate } from '../../types/customTemplate';

interface DiffOverlayProps {
  oldTemplate: CertificateTemplate;
  newTemplate: CertificateTemplate;
  onAcceptDiff: () => void;
  onRejectDiff: () => void;
}

export const DiffOverlay: React.FC<DiffOverlayProps> = ({
  oldTemplate,
  newTemplate,
  onAcceptDiff,
  onRejectDiff,
}) => {
  const aspectRatio = `${newTemplate.widthPx || 1920} / ${newTemplate.heightPx || 1080}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-serif font-bold text-lg text-navy-950 dark:text-white">
              Review Design Tool Changes
            </h3>
            <p className="text-xs text-slate-500">
              Comparing original layout (red outline) with imported design changes (green outline).
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-rose-500 border-dashed bg-rose-500/20" />
              <span>Original</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-emerald-500 bg-emerald-500/20" />
              <span>New / Updated</span>
            </span>
          </div>
        </div>

        {/* Visual Diff Canvas */}
        <div
          style={{ aspectRatio }}
          className="relative w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-inner"
        >
          {newTemplate.previewDataUrl && (
            <img
              src={newTemplate.previewDataUrl}
              alt="Updated Template"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          )}

          {/* Old Boxes (Red Dotted) */}
          {oldTemplate.fields.map((f) => {
            if (!f.box) return null;
            return (
              <div
                key={`old-${f.key}`}
                style={{
                  left: `${f.box.x * 100}%`,
                  top: `${f.box.y * 100}%`,
                  width: `${f.box.w * 100}%`,
                  height: `${f.box.h * 100}%`,
                }}
                className="absolute border-2 border-dashed border-rose-500 bg-rose-500/10 pointer-events-none rounded"
              />
            );
          })}

          {/* New Boxes (Green Solid) */}
          {newTemplate.fields.map((f) => {
            if (!f.box) return null;
            return (
              <div
                key={`new-${f.key}`}
                style={{
                  left: `${f.box.x * 100}%`,
                  top: `${f.box.y * 100}%`,
                  width: `${f.box.w * 100}%`,
                  height: `${f.box.h * 100}%`,
                }}
                className="absolute border-2 border-emerald-500 bg-emerald-500/20 pointer-events-none rounded flex items-start p-1"
              >
                <span className="bg-emerald-800 text-white text-[9px] font-bold px-1 rounded shadow">
                  {f.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onRejectDiff} className="btn-secondary text-xs">
            Keep Original Layout
          </button>
          <button type="button" onClick={onAcceptDiff} className="btn-primary text-xs">
            Apply Imported Changes
          </button>
        </div>
      </div>
    </div>
  );
};
