/**
 * Interactive Field Canvas Component
 * Renders certificate template with interactive, draggable, resizable bounding boxes,
 * floating on-canvas control toolbar, confidence tags, new field drawing, and full keyboard accessibility.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CertificateTemplate, NormalizedBox } from '../../types/customTemplate';
import { snapToGrid } from '../../lib/templateAnalysis';
import {
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Plus,
  Move,
  Minus,
  QrCode,
} from 'lucide-react';

interface FieldCanvasProps {
  template: CertificateTemplate;
  selectedFieldKey: string | null;
  onSelectField: (key: string | null) => void;
  onUpdateFieldBox: (key: string, box: NormalizedBox) => void;
  onAddField: (box: NormalizedBox) => void;
  onDeleteField: (key: string) => void;
  onConfirmConfidence: (key: string) => void;
}

type ResizeHandleType = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w';

export const FieldCanvas: React.FC<FieldCanvasProps> = ({
  template,
  selectedFieldKey,
  onSelectField,
  onUpdateFieldBox,
  onAddField,
  onDeleteField,
  onConfirmConfidence,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing new field state
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<{ x: number; y: number } | null>(null);

  // Dragging existing field state
  const [dragState, setDragState] = useState<{
    fieldKey: string;
    startCoord: { x: number; y: number };
    startBox: NormalizedBox;
  } | null>(null);

  // Resizing existing field state
  const [resizeState, setResizeState] = useState<{
    fieldKey: string;
    handle: ResizeHandleType;
    startCoord: { x: number; y: number };
    startBox: NormalizedBox;
  } | null>(null);

  const getNormalizedCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  // Global mousemove and mouseup listeners for smooth dragging & resizing outside canvas
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const coords = getNormalizedCoords(e.clientX, e.clientY);

      // Handle Dragging / Moving
      if (dragState) {
        const dx = coords.x - dragState.startCoord.x;
        const dy = coords.y - dragState.startCoord.y;
        const { startBox } = dragState;

        const maxAllowedX = Math.max(0, 1 - startBox.w);
        const maxAllowedY = Math.max(0, 1 - startBox.h);

        const newX = snapToGrid(Math.max(0, Math.min(maxAllowedX, startBox.x + dx)));
        const newY = snapToGrid(Math.max(0, Math.min(maxAllowedY, startBox.y + dy)));

        onUpdateFieldBox(dragState.fieldKey, {
          x: newX,
          y: newY,
          w: startBox.w,
          h: startBox.h,
        });
        return;
      }

      // Handle Resizing
      if (resizeState) {
        const dx = coords.x - resizeState.startCoord.x;
        const dy = coords.y - resizeState.startCoord.y;
        const { startBox, handle } = resizeState;

        let newX = startBox.x;
        let newY = startBox.y;
        let newW = startBox.w;
        let newH = startBox.h;

        const MIN_W = 0.02;
        const MIN_H = 0.015;

        if (handle === 'se') {
          newW = Math.max(MIN_W, Math.min(1 - startBox.x, startBox.w + dx));
          newH = Math.max(MIN_H, Math.min(1 - startBox.y, startBox.h + dy));
        } else if (handle === 'sw') {
          const right = startBox.x + startBox.w;
          newX = Math.max(0, Math.min(right - MIN_W, startBox.x + dx));
          newW = right - newX;
          newH = Math.max(MIN_H, Math.min(1 - startBox.y, startBox.h + dy));
        } else if (handle === 'ne') {
          const bottom = startBox.y + startBox.h;
          newY = Math.max(0, Math.min(bottom - MIN_H, startBox.y + dy));
          newH = bottom - newY;
          newW = Math.max(MIN_W, Math.min(1 - startBox.x, startBox.w + dx));
        } else if (handle === 'nw') {
          const right = startBox.x + startBox.w;
          const bottom = startBox.y + startBox.h;
          newX = Math.max(0, Math.min(right - MIN_W, startBox.x + dx));
          newW = right - newX;
          newY = Math.max(0, Math.min(bottom - MIN_H, startBox.y + dy));
          newH = bottom - newY;
        } else if (handle === 'e') {
          newW = Math.max(MIN_W, Math.min(1 - startBox.x, startBox.w + dx));
        } else if (handle === 'w') {
          const right = startBox.x + startBox.w;
          newX = Math.max(0, Math.min(right - MIN_W, startBox.x + dx));
          newW = right - newX;
        } else if (handle === 's') {
          newH = Math.max(MIN_H, Math.min(1 - startBox.y, startBox.h + dy));
        } else if (handle === 'n') {
          const bottom = startBox.y + startBox.h;
          newY = Math.max(0, Math.min(bottom - MIN_H, startBox.y + dy));
          newH = bottom - newY;
        }

        onUpdateFieldBox(resizeState.fieldKey, {
          x: snapToGrid(newX),
          y: snapToGrid(newY),
          w: snapToGrid(newW),
          h: snapToGrid(newH),
        });
        return;
      }

      // Handle Drawing New Box
      if (drawingStart) {
        setDrawingCurrent(coords);
      }
    };

    const handleGlobalMouseUp = () => {
      if (drawingStart && drawingCurrent) {
        const minX = Math.min(drawingStart.x, drawingCurrent.x);
        const minY = Math.min(drawingStart.y, drawingCurrent.y);
        const w = Math.abs(drawingCurrent.x - drawingStart.x);
        const h = Math.abs(drawingCurrent.y - drawingStart.y);

        if (w >= 0.02 && h >= 0.015) {
          onAddField({
            x: snapToGrid(minX),
            y: snapToGrid(minY),
            w: snapToGrid(w),
            h: snapToGrid(h),
          });
        }
      }

      setDragState(null);
      setResizeState(null);
      setDrawingStart(null);
      setDrawingCurrent(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, resizeState, drawingStart, drawingCurrent, getNormalizedCoords, onUpdateFieldBox, onAddField]);

  // Keyboard navigation & delete support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedFieldKey) return;
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const field = template.fields.find((f) => f.key === selectedFieldKey);
      if (!field || !field.box) return;

      const step = e.shiftKey ? 0.01 : 0.0025; // 0.25% or 1% with shift
      let { x, y, w, h } = field.box;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        x = Math.max(0, snapToGrid(x - step));
        onUpdateFieldBox(selectedFieldKey, { x, y, w, h });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        x = Math.min(1 - w, snapToGrid(x + step));
        onUpdateFieldBox(selectedFieldKey, { x, y, w, h });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        y = Math.max(0, snapToGrid(y - step));
        onUpdateFieldBox(selectedFieldKey, { x, y, w, h });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        y = Math.min(1 - h, snapToGrid(y + step));
        onUpdateFieldBox(selectedFieldKey, { x, y, w, h });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (field.type !== 'qrCode') {
          e.preventDefault();
          onDeleteField(selectedFieldKey);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldKey, template.fields, onUpdateFieldBox, onDeleteField]);

  // Start drawing new field when clicking background canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const coords = getNormalizedCoords(e.clientX, e.clientY);
    setDrawingStart(coords);
    setDrawingCurrent(coords);
    onSelectField(null);
  };

  // Start dragging a field
  const startFieldDrag = (e: React.MouseEvent, fieldKey: string, box: NormalizedBox) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectField(fieldKey);
    const coords = getNormalizedCoords(e.clientX, e.clientY);
    setDragState({
      fieldKey,
      startCoord: coords,
      startBox: { ...box },
    });
  };

  // Start resizing a field
  const startFieldResize = (e: React.MouseEvent, fieldKey: string, box: NormalizedBox, handle: ResizeHandleType) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectField(fieldKey);
    const coords = getNormalizedCoords(e.clientX, e.clientY);
    setResizeState({
      fieldKey,
      handle,
      startCoord: coords,
      startBox: { ...box },
    });
  };

  // Quick QR Scale adjustment helper
  const scaleSelectedField = (delta: number) => {
    if (!selectedFieldKey) return;
    const field = template.fields.find((f) => f.key === selectedFieldKey);
    if (!field || !field.box) return;

    const newW = snapToGrid(Math.max(0.04, Math.min(0.5, field.box.w + delta)));
    const newH = snapToGrid(Math.max(0.04, Math.min(0.5, field.box.h + delta * (field.box.h / field.box.w))));
    const newX = Math.min(1 - newW, field.box.x);
    const newY = Math.min(1 - newH, field.box.y);

    onUpdateFieldBox(selectedFieldKey, {
      x: snapToGrid(newX),
      y: snapToGrid(newY),
      w: newW,
      h: newH,
    });
  };

  // Quick preset positions for QR code
  const setQuickQrPosition = (preset: 'br' | 'bl' | 'bc' | 'tr' | 'tl' | 'center') => {
    if (!selectedFieldKey) return;
    const field = template.fields.find((f) => f.key === selectedFieldKey);
    if (!field || !field.box) return;

    const w = field.box.w || 0.10;
    const h = field.box.h || 0.14;

    let x = field.box.x;
    let y = field.box.y;

    if (preset === 'br') {
      x = 1 - w - 0.05;
      y = 1 - h - 0.06;
    } else if (preset === 'bl') {
      x = 0.05;
      y = 1 - h - 0.06;
    } else if (preset === 'bc') {
      x = (1 - w) / 2;
      y = 1 - h - 0.06;
    } else if (preset === 'tr') {
      x = 1 - w - 0.05;
      y = 0.06;
    } else if (preset === 'tl') {
      x = 0.05;
      y = 0.06;
    } else if (preset === 'center') {
      x = (1 - w) / 2;
      y = (1 - h) / 2;
    }

    onUpdateFieldBox(selectedFieldKey, {
      x: snapToGrid(Math.max(0, Math.min(1 - w, x))),
      y: snapToGrid(Math.max(0, Math.min(1 - h, y))),
      w,
      h,
    });
  };

  const aspectRatio = `${template.widthPx || 1920} / ${template.heightPx || 1080}`;
  const selectedField = template.fields.find((f) => f.key === selectedFieldKey);

  return (
    <div className="relative w-full flex flex-col items-center select-none">
      <div
        ref={containerRef}
        onMouseDown={handleCanvasMouseDown}
        style={{ aspectRatio }}
        className="relative w-full overflow-hidden rounded-2xl bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xl cursor-crosshair"
      >
        {/* Template Image Background */}
        {template.previewDataUrl ? (
          <img
            src={template.previewDataUrl}
            alt="Certificate Template"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
            Template Image Preview
          </div>
        )}

        {/* Existing Bounding Boxes */}
        {template.fields.map((field) => {
          if (!field.box) return null;
          const isSelected = field.key === selectedFieldKey;
          const isLowConfidence = field.confidence < 0.7;
          const isQr = field.type === 'qrCode';

          const styleObj: React.CSSProperties = {
            left: `${field.box.x * 100}%`,
            top: `${field.box.y * 100}%`,
            width: `${field.box.w * 100}%`,
            height: `${field.box.h * 100}%`,
          };

          return (
            <div
              key={field.key}
              onMouseDown={(e) => startFieldDrag(e, field.key, field.box!)}
              style={styleObj}
              className={`absolute transition-colors rounded-md group flex items-start justify-between p-1 cursor-move border-2 ${
                isSelected
                  ? 'border-azure-500 bg-azure-500/25 ring-4 ring-azure-500/40 z-30 shadow-lg'
                  : isLowConfidence
                  ? 'border-amber-500 bg-amber-500/15 z-20 hover:border-amber-600'
                  : isQr
                  ? 'border-emerald-500 bg-emerald-500/20 z-20 hover:border-emerald-400'
                  : 'border-navy-800 bg-navy-900/10 z-10 hover:border-azure-400'
              }`}
            >
              {/* Field Label & Badge */}
              <div className="flex items-center gap-1 bg-navy-950/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow pointer-events-none truncate max-w-[85%]">
                {isQr && <QrCode className="w-3 h-3 text-emerald-400 shrink-0" />}
                <span className="truncate">{field.label}</span>
                {isLowConfidence && (
                  <span
                    className="text-amber-400 flex items-center gap-0.5"
                    title="Low AI confidence (<0.7) - click to confirm"
                  >
                    <AlertTriangle className="w-3 h-3" />
                  </span>
                )}
              </div>

              {/* Action Buttons on Box when selected */}
              {isSelected && (
                <div className="flex items-center gap-1">
                  {isLowConfidence && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfirmConfidence(field.key);
                      }}
                      className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow pointer-events-auto"
                      title="Confirm field detection"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                    </button>
                  )}
                  {!isQr && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteField(field.key);
                      }}
                      className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700 shadow pointer-events-auto"
                      title="Delete field box"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* 8-Point Interactive Resize Handles (Shown when Selected) */}
              {isSelected && (
                <>
                  {/* Top-Left */}
                  <div
                    onMouseDown={(e) => startFieldResize(e, field.key, field.box!, 'nw')}
                    className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-azure-600 rounded-sm cursor-nwse-resize z-40 shadow hover:scale-125 transition-transform"
                    title="Resize top-left"
                  />
                  {/* Top-Right */}
                  <div
                    onMouseDown={(e) => startFieldResize(e, field.key, field.box!, 'ne')}
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-azure-600 rounded-sm cursor-nesw-resize z-40 shadow hover:scale-125 transition-transform"
                    title="Resize top-right"
                  />
                  {/* Bottom-Right */}
                  <div
                    onMouseDown={(e) => startFieldResize(e, field.key, field.box!, 'se')}
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-azure-600 rounded-sm cursor-nwse-resize z-40 shadow hover:scale-125 transition-transform"
                    title="Resize bottom-right"
                  />
                  {/* Bottom-Left */}
                  <div
                    onMouseDown={(e) => startFieldResize(e, field.key, field.box!, 'sw')}
                    className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-azure-600 rounded-sm cursor-nesw-resize z-40 shadow hover:scale-125 transition-transform"
                    title="Resize bottom-left"
                  />
                  {/* North */}
                  <div
                    onMouseDown={(e) => startFieldResize(e, field.key, field.box!, 'n')}
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-2.5 bg-white border-2 border-azure-600 rounded-sm cursor-ns-resize z-40 shadow hover:scale-125 transition-transform"
                  />
                  {/* South */}
                  <div
                    onMouseDown={(e) => startFieldResize(e, field.key, field.box!, 's')}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-2.5 bg-white border-2 border-azure-600 rounded-sm cursor-ns-resize z-40 shadow hover:scale-125 transition-transform"
                  />
                  {/* East */}
                  <div
                    onMouseDown={(e) => startFieldResize(e, field.key, field.box!, 'e')}
                    className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-3.5 bg-white border-2 border-azure-600 rounded-sm cursor-ew-resize z-40 shadow hover:scale-125 transition-transform"
                  />
                  {/* West */}
                  <div
                    onMouseDown={(e) => startFieldResize(e, field.key, field.box!, 'w')}
                    className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-3.5 bg-white border-2 border-azure-600 rounded-sm cursor-ew-resize z-40 shadow hover:scale-125 transition-transform"
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Floating Quick Action Toolbar over Selected Field */}
        {selectedField && selectedField.box && (
          <div
            style={{
              left: `${Math.max(0.01, Math.min(0.7, selectedField.box.x)) * 100}%`,
              top: `${Math.max(0.01, selectedField.box.y > 0.12 ? (selectedField.box.y - 0.08) : (selectedField.box.y + selectedField.box.h + 0.02)) * 100}%`,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute z-50 bg-navy-950/95 backdrop-blur-md text-white border border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-2xl flex items-center gap-2 text-xs animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Drag Handle Indicator */}
            <div
              onMouseDown={(e) => startFieldDrag(e, selectedField.key, selectedField.box!)}
              className="flex items-center gap-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-white pr-1.5 border-r border-slate-700"
              title="Click and drag anywhere on canvas to move"
            >
              <Move className="w-3.5 h-3.5 text-azure-400" />
              <span className="font-semibold text-[11px] hidden sm:inline">Drag to move</span>
            </div>

            {/* QR Specific Quick Adjusters */}
            {selectedField.type === 'qrCode' && (
              <>
                <div className="flex items-center gap-1 pr-1.5 border-r border-slate-700">
                  <span className="text-[10px] text-slate-400 font-medium">Size:</span>
                  <button
                    type="button"
                    onClick={() => scaleSelectedField(-0.02)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                    title="Make QR Smaller"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scaleSelectedField(0.02)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                    title="Make QR Larger"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Quick Placement Presets */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQuickQrPosition('br')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-azure-600 text-[10px] font-medium"
                    title="Bottom-Right"
                  >
                    ↘ BR
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickQrPosition('bc')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-azure-600 text-[10px] font-medium"
                    title="Bottom-Center"
                  >
                    ⬇ BC
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickQrPosition('bl')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-azure-600 text-[10px] font-medium"
                    title="Bottom-Left"
                  >
                    ↙ BL
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickQrPosition('center')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-azure-600 text-[10px] font-medium hidden sm:inline-block"
                    title="Center"
                  >
                    ⏺ Center
                  </button>
                </div>
              </>
            )}

            {selectedField.type !== 'qrCode' && (
              <span className="text-[11px] text-slate-300 font-mono">
                {Math.round(selectedField.box.w * 100)}% × {Math.round(selectedField.box.h * 100)}%
              </span>
            )}
          </div>
        )}

        {/* Temporary Dragging Box for New Field */}
        {drawingStart && drawingCurrent && (
          <div
            style={{
              left: `${Math.min(drawingStart.x, drawingCurrent.x) * 100}%`,
              top: `${Math.min(drawingStart.y, drawingCurrent.y) * 100}%`,
              width: `${Math.abs(drawingCurrent.x - drawingStart.x) * 100}%`,
              height: `${Math.abs(drawingCurrent.y - drawingStart.y) * 100}%`,
            }}
            className="absolute border-2 border-dashed border-azure-400 bg-azure-500/25 rounded-md pointer-events-none z-40 flex items-center justify-center text-azure-200 text-xs font-bold"
          >
            <Plus className="w-4 h-4 mr-1" /> New Field
          </div>
        )}
      </div>

      {/* Helper Legend underneath canvas */}
      <div className="flex flex-wrap items-center justify-between w-full mt-3 px-2 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-azure-500/40 border border-azure-500" />
            <span>Selected (Drag to Move • Handles to Resize)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-500" />
            <span>Verification QR</span>
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          Click & drag any box to move • Drag corner dots to resize • Click canvas to draw new
        </span>
      </div>
    </div>
  );
};
