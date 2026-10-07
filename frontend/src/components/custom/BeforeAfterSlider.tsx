/**
 * Before/After Visual Comparison Slider Component
 * Provides an interactive split view comparing original uploaded design with the cleaned base & AI redesign.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sliders, Sparkles, Image as ImageIcon } from 'lucide-react';

interface BeforeAfterSliderProps {
  originalDataUrl: string;
  redesignedDataUrl: string;
  widthPx?: number;
  heightPx?: number;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  originalDataUrl,
  redesignedDataUrl,
  widthPx = 1920,
  heightPx = 1080,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50); // percentage 0..100
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  const handleMouseDown = () => setIsDragging(true);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMove]);

  const aspectRatio = `${widthPx} / ${heightPx}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
        <div className="flex items-center gap-1.5 text-navy-950 dark:text-white font-bold">
          <Sliders className="w-3.5 h-3.5 text-azure-600" />
          <span>Before / After Redesign Comparison</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1 text-slate-500">
            <ImageIcon className="w-3 h-3" /> Original Upload
          </span>
          <span className="flex items-center gap-1 text-azure-600 font-semibold">
            <Sparkles className="w-3 h-3" /> Cleaned & Redesigned
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ aspectRatio }}
        className="relative w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card select-none cursor-ew-resize bg-slate-900"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        {/* Background Image: Redesigned / Cleaned Base */}
        <img
          src={redesignedDataUrl}
          alt="Redesigned Base"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />

        {/* Foreground Image: Original Upload (Clipped) */}
        <div
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <img
            src={originalDataUrl}
            alt="Original Template"
            className="w-full h-full object-contain pointer-events-none"
          />
        </div>

        {/* Vertical Divider Line */}
        <div
          style={{ left: `${sliderPos}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
        >
          {/* Draggable Handle */}
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-white dark:bg-slate-900 border-2 border-azure-600 rounded-full shadow-md flex items-center justify-center pointer-events-auto cursor-ew-resize">
            <Sliders className="w-3 h-3 text-azure-600" />
          </div>
        </div>

        {/* Badge Labels */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg pointer-events-none">
          Original
        </div>
        <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-azure-600/80 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg pointer-events-none">
          Redesigned
        </div>
      </div>
    </div>
  );
};
