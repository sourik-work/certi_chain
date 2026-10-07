import React, { useState, useRef, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TemplateSpec } from '../../lib/template/types';
import { renderRichSegments } from '../../lib/template/tokens';
import { exportTemplateToPdf, exportTemplateToPng } from '../../lib/template/export';
import { AlertOctagon, AlertTriangle, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { trace } from '../../lib/debugTrace';
import { getDefaultChainId } from '../../config';

interface TemplateRendererProps {
  spec: TemplateSpec;
  values: Record<string, string>;
  mode?: 'editor' | 'issued';
  certId?: string;
  proofHash?: string;
  chainId?: number;
  issuerAddress?: string;
  isRevoked?: boolean;
  revocationReason?: string;
  revocationTimestamp?: bigint;
  highlightFieldKey?: string | null;
  showExportControls?: boolean;
  id?: string;
  className?: string;
}

export const TemplateRenderer: React.FC<TemplateRendererProps> = ({
  spec,
  values,
  mode = 'issued',
  certId,
  proofHash,
  chainId,
  issuerAddress,
  isRevoked = false,
  revocationReason,
  revocationTimestamp,
  highlightFieldKey = null,
  showExportControls = true,
  id = 'template-certificate-preview-node',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  // Build sample-value map from spec.fields for editor fallback
  const sampleValues: Record<string, string> = useMemo(() => {
    const m: Record<string, string> = {};
    (spec?.fields || []).forEach((f) => {
      if (f.sample) m[f.key] = f.sample;
    });
    return m;
  }, [spec?.fields]);

  // Merge: user-entered values take priority; fall back to sample in editor mode
  const effectiveValues = useMemo(() => {
    if (mode === 'editor') {
      const merged: Record<string, string> = { ...sampleValues };
      Object.entries(values || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          merged[k] = String(v);
        }
      });
      return merged;
    }
    return values || {};
  }, [mode, values, sampleValues]);

  // Trace render branch
  useEffect(() => {
    if (!spec) return;
    trace('render.branch', {
      component: 'TemplateRenderer',
      mode,
      templateValuesKeys: Object.keys(effectiveValues),
      templateId: spec?.id,
      templateName: spec?.name,
      canvas: spec?.canvas,
    });
  }, [spec?.id, spec?.name, spec?.canvas, mode, effectiveValues]);

  // Post-paint DOM inspection trace
  useEffect(() => {
    if (!containerRef.current) return;
    const blockElements = containerRef.current.querySelectorAll<HTMLElement>('[data-certi-block-id]');
    const blockDomData: Array<{
      id: string;
      rect: { left: number; top: number; width: number; height: number };
      fontSize: string;
      color: string;
      opacity: string;
      visibility: string;
      zIndex: string;
      overflow: string;
      text: string;
    }> = [];

    blockElements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      blockDomData.push({
        id: el.getAttribute('data-certi-block-id') || '',
        rect: {
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
        },
        fontSize: computed.fontSize,
        color: computed.color,
        opacity: computed.opacity,
        visibility: computed.visibility,
        zIndex: computed.zIndex,
        overflow: computed.overflow,
        text: el.textContent?.trim() || '',
      });
    });

    trace('render.dom', {
      blockCount: blockDomData.length,
      blocks: blockDomData,
      scale,
    });
  }, [spec.blocks, values, scale]);

  // Derive responsive display scale to fit parent container width using ResizeObserver with window fallback
  useEffect(() => {
    if (!containerRef.current || !spec.canvas.width) return;

    const el = containerRef.current;
    const update = () => {
      const w = el.clientWidth || el.parentElement?.clientWidth || 0;
      if (w > 0 && spec.canvas.width > 0) {
        setScale(w / spec.canvas.width);
      }
    };

    update();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0 && spec.canvas.width > 0) {
            setScale(w / spec.canvas.width);
          }
        }
      });

      observer.observe(el);
      return () => observer.disconnect();
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
  }, [spec.canvas.width]);

  // Guard: Do not attempt to render until template spec and canvas are fully populated
  if (!spec || !spec.canvas || !spec.canvas.width || !spec.canvas.height) {
    return (
      <div className={`w-full flex items-center justify-center p-8 bg-slate-900/5 border border-slate-200 rounded-xl min-h-[300px] text-slate-400 ${className}`}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-azure-600" />
          <span className="text-xs font-medium">Loading template canvas...</span>
        </div>
      </div>
    );
  }

  const activeChain = chainId || getDefaultChainId();
  const displayCertId = certId || proofHash || '0x0000000000000000000000000000000000000000000000000000000000000000';
  const verificationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify/${displayCertId}?chain=${activeChain}`
    : `https://certichain.ledger/verify/${displayCertId}?chain=${activeChain}`;

  const shortCertId = displayCertId.length > 12 ? `${displayCertId.slice(0, 10)}...` : displayCertId;
  const shortIssuer = issuerAddress
    ? `${issuerAddress.slice(0, 6)}...${issuerAddress.slice(-4)}`
    : '0x0000...0000';

  const recipientName = values?.['recipient_name'] || 'Recipient';
  const certificateTitle = values?.['credential_title'] || spec.name || 'Certificate';

  // Track all missing keys across all blocks in issued mode
  const missingKeys = new Set<string>();
  (spec.blocks || []).forEach((block) => {
    if (block.eraseOnly) return;
    const segments = renderRichSegments(block.text, effectiveValues, block.tokenStyles, mode);
    segments.forEach((seg) => {
      if (seg.isToken && seg.key) {
        const origin = (seg.key in effectiveValues && effectiveValues[seg.key] !== undefined && effectiveValues[seg.key] !== null && String(effectiveValues[seg.key]).trim() !== '')
          ? 'templateValues'
          : (mode === 'editor' ? 'sample' : 'empty');
        trace('render.tokens', {
          blockId: block.id,
          token: seg.key,
          value: seg.text,
          origin,
          mode,
        });
        if (seg.isMissing) {
          missingKeys.add(seg.key);
        }
      }
    });
  });

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportTemplateToPdf({
        elementId: id,
        spec,
        certificateTitle,
        recipientName,
      });
    } catch (err) {
      trace('errors', { context: 'exportTemplateToPdf', error: err instanceof Error ? err.message : String(err) });
      console.error('PDF export failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportPng = async () => {
    setIsExportingPng(true);
    try {
      await exportTemplateToPng({
        elementId: id,
        spec,
        certificateTitle,
        recipientName,
      });
    } catch (err) {
      trace('errors', { context: 'exportTemplateToPng', error: err instanceof Error ? err.message : String(err) });
      console.error('PNG export failed:', err);
    } finally {
      setIsExportingPng(false);
    }
  };

  const formattedRevokeDate = revocationTimestamp
    ? new Date(Number(revocationTimestamp) * 1000).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className={`w-full flex flex-col items-center select-none ${className}`}>
      {/* Invariant I1 Error Banner if missing tokens in issued mode */}
      {mode === 'issued' && missingKeys.size > 0 && (
        <div className="w-full bg-rose-50 border border-rose-300 text-rose-800 px-4 py-2.5 rounded-xl mb-3 text-xs font-semibold flex items-center gap-2 shadow-sm animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            Certificate data incomplete: missing {Array.from(missingKeys).map(k => `{{${k}}}`).join(', ')}
          </span>
        </div>
      )}

      {/* Outer Scaling Viewport with Aspect-Ratio Preserving Container */}
      <div
        ref={containerRef}
        className="w-full relative overflow-hidden rounded-xl bg-slate-900/5 border border-slate-200/80 shadow-md"
        style={{
          aspectRatio: `${spec.canvas.width} / ${spec.canvas.height}`,
        }}
      >
        {/* Natural Size Pixel Canvas Node (Scaled via CSS transform for display) */}
        <div
          id={id}
          className="absolute top-0 left-0 bg-white shadow-2xl"
          style={{
            width: `${spec.canvas.width}px`,
            height: `${spec.canvas.height}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* Layer 1: Background Image */}
          {spec.background?.dataUrl && (
            <img
              src={spec.background.dataUrl}
              alt={spec.name || 'Certificate Template'}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              crossOrigin="anonymous"
              loading="eager"
            />
          )}

          {/* Layer 2: Text Blocks */}
          {(spec.blocks || []).map((block) => {
            if (block.eraseOnly) return null;

            // Check if any token in this block matches the focused form input
            const isHighlighted =
              highlightFieldKey &&
              block.text.includes(`{{${highlightFieldKey}`);

            const segments = renderRichSegments(block.text, effectiveValues, block.tokenStyles, mode);

            const style: React.CSSProperties = {
              position: 'absolute',
              left: `${block.rect.x}px`,
              top: `${block.rect.y}px`,
              width: `${block.rect.w}px`,
              height: `${block.rect.h}px`,
              fontFamily: `"${block.style.fontFamily}", sans-serif`,
              fontWeight: block.style.fontWeight,
              fontSize: `${block.style.fontSize}px`,
              color: block.style.color,
              textAlign: block.style.align,
              lineHeight: block.style.lineHeight,
              letterSpacing: `${block.style.letterSpacing}px`,
              textTransform: block.style.transform !== 'none' ? block.style.transform : undefined,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              overflow: 'hidden',
              wordBreak: 'break-word',
            };

            return (
              <div
                key={block.id}
                data-certi-block-id={block.id}
                style={style}
                className={`transition-all duration-200 ${
                  isHighlighted ? 'ring-4 ring-azure-500/80 bg-azure-500/10 rounded-sm' : ''
                }`}
              >
                <div>
                  {segments.map((seg, i) => {
                    if (!seg.isToken || !seg.style) {
                      if (seg.isMissing) {
                        return (
                          <span
                            key={i}
                            className="bg-rose-100 text-rose-700 px-1 py-0.5 rounded border border-rose-300 font-mono text-xs"
                          >
                            {seg.text}
                          </span>
                        );
                      }
                      return <span key={i}>{seg.text}</span>;
                    }
                    const tokenInlineStyle: React.CSSProperties = {
                      fontWeight: seg.style.fontWeight,
                      color: seg.isMissing ? '#be123c' : seg.style.color,
                      fontSize: seg.style.fontSize ? `${seg.style.fontSize}px` : undefined,
                      textTransform: seg.style.transform !== 'none' ? seg.style.transform : undefined,
                    };
                    return (
                      <span
                        key={i}
                        style={tokenInlineStyle}
                        className={seg.isMissing ? 'bg-rose-100 text-rose-700 px-1 py-0.5 rounded border border-rose-300 font-mono' : ''}
                      >
                        {seg.text}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Layer 3: QR Code Placement */}
          {spec.qr && (
            <div
              style={{
                position: 'absolute',
                left: `${spec.qr.rect.x}px`,
                top: `${spec.qr.rect.y}px`,
                width: `${spec.qr.rect.w}px`,
                height: `${spec.qr.rect.h}px`,
              }}
              className="flex flex-col items-center justify-center"
            >
              <div
                className={`flex flex-col items-center justify-center p-2.5 ${
                  spec.qr.tile ? 'bg-white/95 rounded-xl shadow-md border border-slate-200/80' : ''
                }`}
                style={{
                  width: '100%',
                  height: '100%',
                }}
              >
                <div className="w-full h-full max-w-[82%] max-h-[82%] flex items-center justify-center">
                  <QRCodeSVG
                    value={verificationUrl}
                    size={Math.min(spec.qr.rect.w, spec.qr.rect.h) * 0.75}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                {spec.qr.caption && (
                  <p
                    className="text-center font-mono font-medium tracking-tight text-slate-700 truncate w-full mt-1"
                    style={{ fontSize: `${Math.max(10, Math.round(spec.qr.rect.w * 0.065))}px` }}
                  >
                    {spec.qr.caption}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Layer 4: Verification Strip */}
          {spec.verifyStrip && (
            <div
              style={{
                position: 'absolute',
                left: `${spec.verifyStrip.rect.x}px`,
                top: `${spec.verifyStrip.rect.y}px`,
                width: `${spec.verifyStrip.rect.w}px`,
                height: `${spec.verifyStrip.rect.h}px`,
                fontFamily: `"${spec.verifyStrip.style.fontFamily}", sans-serif`,
                fontWeight: spec.verifyStrip.style.fontWeight,
                fontSize: `${spec.verifyStrip.style.fontSize}px`,
                color: spec.verifyStrip.style.color,
                textAlign: spec.verifyStrip.style.align,
                lineHeight: spec.verifyStrip.style.lineHeight,
              }}
              className="flex items-center justify-center truncate px-2 font-mono"
            >
              <span>
                Verification ID: <strong>{shortCertId}</strong> &nbsp;|&nbsp; Issuer:{' '}
                <strong>{shortIssuer}</strong> &nbsp;|&nbsp; On-Chain Verifiable
              </span>
            </div>
          )}

          {/* Revocation Overlay if Revoked */}
          {isRevoked && (
            <div className="absolute inset-0 bg-rose-950/75 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
              <div className="bg-white border-4 border-rose-600 px-10 py-8 rounded-3xl shadow-2xl max-w-xl">
                <div className="flex items-center justify-center gap-3 text-rose-700 font-extrabold text-2xl mb-2 uppercase tracking-wider">
                  <AlertOctagon className="w-8 h-8" />
                  Certificate Revoked
                </div>
                {revocationReason && (
                  <p className="text-base text-slate-800 mt-2 font-medium">
                    <strong>Reason:</strong> {revocationReason}
                  </p>
                )}
                {formattedRevokeDate && (
                  <p className="text-sm text-slate-500 mt-2 font-mono">
                    Revoked on: {formattedRevokeDate}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Toolbar */}
      {showExportControls && (
        <div className="w-full flex flex-wrap items-center justify-end gap-2.5 pt-3">
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="btn-secondary text-xs sm:text-sm"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-navy-900" />
            )}
            <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF (Custom Layout)'}</span>
          </button>

          <button
            onClick={handleExportPng}
            disabled={isExportingPng}
            className="btn-secondary text-xs sm:text-sm"
          >
            {isExportingPng ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4 text-azure-600" />
            )}
            <span>{isExportingPng ? 'Generating PNG...' : 'Download PNG (High-Res)'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
