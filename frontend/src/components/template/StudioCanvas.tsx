import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Rect, TemplateBlock, QrPlacement } from '../../lib/template/types';
import { OcrWord } from '../../lib/template/ocr';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface StudioCanvasProps {
  backgroundImageUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  blocks: TemplateBlock[];
  qr: QrPlacement;
  selectedBlockId: string | null;
  isSelectedQr: boolean;
  activeTool: 'select' | 'draw' | 'pan' | 'click_text';
  ocrWords?: OcrWord[];
  onSelectBlock: (id: string | null) => void;
  onSelectQr: (selected: boolean) => void;
  onUpdateBlockRect: (id: string, rect: Rect) => void;
  onUpdateQrRect: (rect: Rect) => void;
  onAddBlock: (rect: Rect) => void;
  onWordClick?: (word: OcrWord, shiftKey: boolean) => void;
  onDeleteSelected: () => void;
}

type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  backgroundImageUrl,
  canvasWidth,
  canvasHeight,
  blocks = [],
  qr,
  selectedBlockId,
  isSelectedQr,
  activeTool,
  ocrWords = [],
  onSelectBlock,
  onSelectQr,
  onUpdateBlockRect,
  onUpdateQrRect,
  onAddBlock,
  onWordClick,
  onDeleteSelected,
}) => {
  const words = ocrWords || [];
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Dragging / Resizing / Drawing states
  const [dragMode, setDragMode] = useState<'move' | HandleType | 'draw' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialRect, setInitialRect] = useState<Rect | null>(null);
  const [drawRect, setDrawRect] = useState<Rect | null>(null);

  // Auto-fit to screen on mount
  useEffect(() => {
    if (containerRef.current && canvasWidth > 0 && canvasHeight > 0) {
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth > 0 && clientHeight > 0) {
        const fitZoomX = (clientWidth - 64) / canvasWidth;
        const fitZoomY = (clientHeight - 64) / canvasHeight;
        const initialZoom = Math.min(fitZoomX, fitZoomY, 0.85);
        setZoom(Math.max(0.2, Math.min(1.5, initialZoom)));

        // Center canvas
        const x = (clientWidth - canvasWidth * initialZoom) / 2;
        const y = (clientHeight - canvasHeight * initialZoom) / 2;
        setPan({ x: Math.max(20, x), y: Math.max(20, y) });
      }
    }
  }, [canvasWidth, canvasHeight]);

  // Handle keyboard shortcuts (Delete, arrow nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBlockId || isSelectedQr) {
          e.preventDefault();
          onDeleteSelected();
        }
      }

      // Arrow keys nudging
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        if (selectedBlockId) {
          const block = blocks.find((b) => b.id === selectedBlockId);
          if (block) {
            e.preventDefault();
            onUpdateBlockRect(block.id, {
              x: Math.max(0, Math.min(canvasWidth - block.rect.w, block.rect.x + dx)),
              y: Math.max(0, Math.min(canvasHeight - block.rect.h, block.rect.y + dy)),
              w: block.rect.w,
              h: block.rect.h,
            });
          }
        } else if (isSelectedQr) {
          e.preventDefault();
          onUpdateQrRect({
            x: Math.max(0, Math.min(canvasWidth - qr.rect.w, qr.rect.x + dx)),
            y: Math.max(0, Math.min(canvasHeight - qr.rect.h, qr.rect.y + dy)),
            w: qr.rect.w,
            h: qr.rect.h,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, isSelectedQr, blocks, qr, canvasWidth, canvasHeight, onDeleteSelected, onUpdateBlockRect, onUpdateQrRect]);

  const screenToCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left - pan.x;
      const relativeY = clientY - rect.top - pan.y;
      return {
        x: Math.round(relativeX / zoom),
        y: Math.round(relativeY / zoom),
      };
    },
    [pan, zoom]
  );

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomDelta = e.deltaY < 0 ? 0.05 : -0.05;
      setZoom((z) => Math.max(0.15, Math.min(2.5, z + zoomDelta)));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeTool === 'pan' || e.button === 1) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (activeTool === 'draw') {
      const coords = screenToCanvasCoords(e.clientX, e.clientY);
      setDragMode('draw');
      setDragStart(coords);
      setDrawRect({ x: coords.x, y: coords.y, w: 1, h: 1 });
      return;
    }

    // Clicked on blank area of canvas
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
      onSelectBlock(null);
      onSelectQr(false);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
      return;
    }

    if (!dragMode) return;

    const coords = screenToCanvasCoords(e.clientX, e.clientY);

    if (dragMode === 'draw') {
      const x0 = Math.min(dragStart.x, coords.x);
      const y0 = Math.min(dragStart.y, coords.y);
      const w = Math.abs(coords.x - dragStart.x);
      const h = Math.abs(coords.y - dragStart.y);
      setDrawRect({ x: x0, y: y0, w, h });
      return;
    }

    if (!initialRect) return;

    const dx = coords.x - dragStart.x;
    const dy = coords.y - dragStart.y;

    let newRect: Rect = { ...initialRect };

    if (dragMode === 'move') {
      newRect.x = Math.max(0, Math.min(canvasWidth - initialRect.w, initialRect.x + dx));
      newRect.y = Math.max(0, Math.min(canvasHeight - initialRect.h, initialRect.y + dy));
    } else if (dragMode === 'br') {
      newRect.w = Math.max(20, initialRect.w + dx);
      newRect.h = Math.max(12, initialRect.h + dy);
    } else if (dragMode === 'tl') {
      newRect.x = Math.min(initialRect.x + initialRect.w - 20, initialRect.x + dx);
      newRect.y = Math.min(initialRect.y + initialRect.h - 12, initialRect.y + dy);
      newRect.w = initialRect.w - (newRect.x - initialRect.x);
      newRect.h = initialRect.h - (newRect.y - initialRect.y);
    } else if (dragMode === 'tr') {
      newRect.y = Math.min(initialRect.y + initialRect.h - 12, initialRect.y + dy);
      newRect.w = Math.max(20, initialRect.w + dx);
      newRect.h = initialRect.h - (newRect.y - initialRect.y);
    } else if (dragMode === 'bl') {
      newRect.x = Math.min(initialRect.x + initialRect.w - 20, initialRect.x + dx);
      newRect.w = initialRect.w - (newRect.x - initialRect.x);
      newRect.h = Math.max(12, initialRect.h + dy);
    } else if (dragMode === 'r') {
      newRect.w = Math.max(20, initialRect.w + dx);
    } else if (dragMode === 'b') {
      newRect.h = Math.max(12, initialRect.h + dy);
    }

    if (selectedBlockId) {
      onUpdateBlockRect(selectedBlockId, newRect);
    } else if (isSelectedQr) {
      onUpdateQrRect(newRect);
    }
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (dragMode === 'draw' && drawRect) {
      if (drawRect.w > 15 && drawRect.h > 10) {
        onAddBlock(drawRect);
      }
      setDrawRect(null);
    }

    setDragMode(null);
    setInitialRect(null);
  };

  const startDragging = (e: React.PointerEvent, mode: 'move' | HandleType, rect: Rect) => {
    e.stopPropagation();
    const coords = screenToCanvasCoords(e.clientX, e.clientY);
    setDragMode(mode);
    setDragStart(coords);
    setInitialRect({ ...rect });
  };

  const fitToScreen = () => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      const fitZoom = Math.min((clientWidth - 64) / canvasWidth, (clientHeight - 64) / canvasHeight);
      setZoom(Math.max(0.2, Math.min(1.5, fitZoom)));
      setPan({
        x: (clientWidth - canvasWidth * fitZoom) / 2,
        y: (clientHeight - canvasHeight * fitZoom) / 2,
      });
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      {/* Floating Canvas Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-lg text-white">
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono px-2 text-slate-300 min-w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(0.15, z - 0.1))}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-slate-700 mx-1" />
        <button
          onClick={fitToScreen}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs"
          title="Fit to screen"
        >
          <Maximize2 className="w-4 h-4" />
          <span>Fit</span>
        </button>
      </div>

      {/* Role Color Legend */}
      <div className="absolute top-4 right-4 z-20 hidden sm:flex items-center gap-4 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/60 shadow-lg text-[11px] text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
          <span>Variable Field</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-400/30" />
          <span>Fixed (Untouched)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-orange-500/30" />
          <span>Erase Only</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
          <span>QR Placement</span>
        </div>
      </div>

      {/* Interactive Canvas Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`w-full h-full overflow-hidden ${
          activeTool === 'pan' || isPanning ? 'cursor-grab active:cursor-grabbing' : activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'
        }`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
          }}
          className="relative bg-white shadow-2xl origin-top-left"
        >
          {/* Background Image */}
          <img
            src={backgroundImageUrl}
            alt="Certificate Canvas"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            crossOrigin="anonymous"
          />

          {/* OCR Word Chips Overlay (Click the text mode) */}
          {words.length > 0 && (
            <div className={`absolute inset-0 ${activeTool === 'click_text' ? 'z-20 pointer-events-auto' : 'z-5 pointer-events-none opacity-40'}`}>
              {words.map((word) => {
                const w = Math.max(12, word.bbox.x1 - word.bbox.x0);
                const h = Math.max(10, word.bbox.y1 - word.bbox.y0);
                return (
                  <div
                    key={word.id}
                    onClick={(e) => {
                      if (onWordClick) {
                        e.stopPropagation();
                        onWordClick(word, e.shiftKey);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: `${word.bbox.x0}px`,
                      top: `${word.bbox.y0}px`,
                      width: `${w}px`,
                      height: `${h}px`,
                    }}
                    title={`Click to anchor: "${word.text}" (Conf: ${Math.round(word.confidence)}%)`}
                    className="group border border-dashed border-cyan-400/80 bg-cyan-500/10 hover:bg-cyan-500/30 hover:border-cyan-200 cursor-pointer transition-all rounded-xs flex items-center justify-center overflow-hidden"
                  >
                    <span className="opacity-0 group-hover:opacity-100 bg-slate-900/90 text-cyan-300 text-[9px] px-1 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-30">
                      {word.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Text Blocks Overlay */}
          {blocks.map((block) => {
            const isSelected = selectedBlockId === block.id;
            let roleBorder = 'border-slate-400 bg-slate-400/10 text-slate-700';
            if (block.role === 'variable' || block.role === 'paragraph') {
              roleBorder = 'border-blue-500 bg-blue-500/15 text-blue-900';
            } else if (block.eraseOnly || block.role === 'erase_only') {
              roleBorder = 'border-orange-500 bg-orange-500/20 text-orange-900';
            }

            return (
              <div
                key={block.id}
                onPointerDown={(e) => {
                  onSelectBlock(block.id);
                  onSelectQr(false);
                  startDragging(e, 'move', block.rect);
                }}
                style={{
                  position: 'absolute',
                  left: `${block.rect.x}px`,
                  top: `${block.rect.y}px`,
                  width: `${block.rect.w}px`,
                  height: `${block.rect.h}px`,
                }}
                className={`absolute border-2 transition-shadow cursor-move ${roleBorder} ${
                  isSelected ? 'ring-4 ring-azure-400 border-white shadow-xl z-30' : 'hover:border-white z-10'
                }`}
              >
                {/* Block Content / Tag */}
                <div className="w-full h-full flex items-center justify-center p-1 text-[11px] font-mono truncate overflow-hidden">
                  <span className="bg-slate-900/80 text-white px-1.5 py-0.5 rounded text-[10px] truncate max-w-full">
                    {block.eraseOnly ? 'Erase Area' : block.text || 'Empty Block'}
                  </span>
                </div>

                {/* Resize Handles (when selected) */}
                {isSelected && (
                  <>
                    <div
                      onPointerDown={(e) => startDragging(e, 'tl', block.rect)}
                      className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-azure-600 rounded-sm cursor-nwse-resize z-40"
                    />
                    <div
                      onPointerDown={(e) => startDragging(e, 'tr', block.rect)}
                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-azure-600 rounded-sm cursor-nesw-resize z-40"
                    />
                    <div
                      onPointerDown={(e) => startDragging(e, 'bl', block.rect)}
                      className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-azure-600 rounded-sm cursor-nesw-resize z-40"
                    />
                    <div
                      onPointerDown={(e) => startDragging(e, 'br', block.rect)}
                      className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-azure-600 rounded-sm cursor-nwse-resize z-40"
                    />
                  </>
                )}
              </div>
            );
          })}

          {/* QR Placement Box */}
          {qr && (
            <div
              onPointerDown={(e) => {
                onSelectQr(true);
                onSelectBlock(null);
                startDragging(e, 'move', qr.rect);
              }}
              style={{
                position: 'absolute',
                left: `${qr.rect.x}px`,
                top: `${qr.rect.y}px`,
                width: `${qr.rect.w}px`,
                height: `${qr.rect.h}px`,
              }}
              className={`absolute border-2 border-emerald-500 bg-emerald-500/20 cursor-move flex flex-col items-center justify-center p-1 text-[11px] font-mono text-emerald-950 ${
                isSelectedQr ? 'ring-4 ring-emerald-400 border-white shadow-xl z-30' : 'hover:border-white z-10'
              }`}
            >
              <span className="bg-emerald-900 text-emerald-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                QR Tile
              </span>

              {isSelectedQr && (
                <>
                  <div
                    onPointerDown={(e) => startDragging(e, 'tl', qr.rect)}
                    className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-emerald-600 rounded-sm cursor-nwse-resize z-40"
                  />
                  <div
                    onPointerDown={(e) => startDragging(e, 'br', qr.rect)}
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-emerald-600 rounded-sm cursor-nwse-resize z-40"
                  />
                </>
              )}
            </div>
          )}

          {/* Drawing Box Preview */}
          {drawRect && (
            <div
              style={{
                position: 'absolute',
                left: `${drawRect.x}px`,
                top: `${drawRect.y}px`,
                width: `${drawRect.w}px`,
                height: `${drawRect.h}px`,
              }}
              className="border-2 border-dashed border-azure-500 bg-azure-500/25 pointer-events-none z-50"
            />
          )}
        </div>
      </div>
    </div>
  );
};
