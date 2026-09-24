import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CertificateMetadata } from '../types/certificate';
import { exportToPdf, exportToPng } from '../lib/export';
import { ShieldCheck, Award, AlertOctagon, CheckCircle2, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';

interface CertificatePreviewProps {
  metadata: Partial<CertificateMetadata>;
  proofHash?: string;
  certId?: string;
  isRevoked?: boolean;
  revocationReason?: string;
  revocationTimestamp?: bigint;
  isAuthorizedIssuer?: boolean;
  showExportControls?: boolean;
  id?: string; // DOM id for export canvas capture
}

export const CertificatePreview: React.FC<CertificatePreviewProps> = ({
  metadata,
  proofHash,
  certId,
  isRevoked = false,
  revocationReason,
  revocationTimestamp,
  isAuthorizedIssuer = true,
  showExportControls = true,
  id = 'certificate-preview-node',
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const displayCertId = certId || proofHash || '0x0000000000000000000000000000000000000000000000000000000000000000';
  const verificationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify/${displayCertId}`
    : `https://certichain.ledger/verify/${displayCertId}`;

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportToPdf({
        elementId: id,
        certificateTitle: metadata.certificateTitle,
        recipientName: metadata.recipientName,
      });
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportPng = async () => {
    setIsExportingPng(true);
    try {
      await exportToPng({
        elementId: id,
        certificateTitle: metadata.certificateTitle,
        recipientName: metadata.recipientName,
      });
    } catch (err) {
      console.error('PNG export failed:', err);
    } finally {
      setIsExportingPng(false);
    }
  };

  const formattedIssueDate = metadata.issueDate
    ? new Date(metadata.issueDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'September 24, 2026';

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
    <div className="w-full space-y-3">
      <div
        id={id}
        className="relative w-full max-w-4xl mx-auto bg-gradient-to-b from-slate-900 via-slate-920 to-slate-950 text-slate-100 rounded-2xl p-8 sm:p-12 shadow-2xl border-4 border-double border-teal-500/40 overflow-hidden select-none"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(20, 184, 166, 0.15)',
        }}
      >
      {/* Decorative Guilloche Border Accents */}
      <div className="absolute top-2 left-2 right-2 bottom-2 border border-teal-500/20 rounded-xl pointer-events-none" />
      <div className="absolute top-3.5 left-3.5 right-3.5 bottom-3.5 border border-dashed border-teal-500/15 rounded-lg pointer-events-none" />

      {/* Background Seal Watermark */}
      <div className="absolute -right-16 -bottom-16 w-80 h-80 opacity-[0.03] pointer-events-none text-teal-400">
        <Award className="w-full h-full" />
      </div>

      {/* Revocation Watermark Overlay if Revoked */}
      {isRevoked && (
        <div className="absolute inset-0 bg-rose-950/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
          <div className="bg-rose-950/90 border-2 border-rose-500 px-6 py-4 rounded-2xl shadow-2xl max-w-md">
            <div className="flex items-center justify-center gap-2 text-rose-400 font-bold text-xl mb-1 uppercase tracking-widest">
              <AlertOctagon className="w-6 h-6" />
              Certificate Revoked
            </div>
            {revocationReason && (
              <p className="text-sm text-rose-200 mt-2">
                <strong>Reason:</strong> {revocationReason}
              </p>
            )}
            {formattedRevokeDate && (
              <p className="text-xs text-rose-300/80 mt-1">
                Revoked on: {formattedRevokeDate}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header / Institution Banner */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-teal-500/20 pb-6 mb-8 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-teal-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Award className="w-6 h-6 text-teal-400" />
            </div>
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-teal-300 tracking-wide">
              {metadata.issuerName || 'CertiChain Issuing Authority'}
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Issuer Address:{' '}
              <span className="text-slate-300">
                {metadata.issuerAddress
                  ? `${metadata.issuerAddress.slice(0, 10)}...${metadata.issuerAddress.slice(-8)}`
                  : '0x0000...0000'}
              </span>
            </p>
          </div>
        </div>

        {/* Verification Status Badge */}
        <div className="flex items-center gap-2">
          {isAuthorizedIssuer ? (
            <div className="badge-valid">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified Issuer</span>
            </div>
          ) : (
            <div className="badge-tampered">
              <span>Unverified Issuer</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Certificate Body */}
      <div className="relative z-10 text-center space-y-5 my-6">
        <p className="text-xs uppercase tracking-[0.3em] font-semibold text-teal-400/90 font-mono">
          Certificate of Achievement & Credential
        </p>

        <p className="text-xs text-slate-400 italic">This is proudly presented to</p>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold bg-gradient-to-r from-teal-200 via-emerald-100 to-teal-300 bg-clip-text text-transparent px-4 py-1 tracking-tight">
          {metadata.recipientName || 'Recipient Full Name'}
        </h1>

        <p className="text-xs font-mono text-slate-400">
          Holder ID / Wallet:{' '}
          <span className="text-teal-400">
            {metadata.recipientIdentifier || '0x7099...79C8'}
          </span>
        </p>

        <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-teal-500 to-transparent mx-auto my-3" />

        <div className="max-w-2xl mx-auto space-y-2">
          <p className="text-xs text-slate-400">for successfully fulfilling all requirements for</p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 font-serif tracking-wide">
            {metadata.certificateTitle || 'Certified Blockchain Architecture & Security'}
          </h2>
          {metadata.description && (
            <p className="text-xs text-slate-300/90 max-w-xl mx-auto leading-relaxed pt-1">
              {metadata.description}
            </p>
          )}
        </div>

        {/* Additional Fields Key-Value Display */}
        {metadata.additionalFields && Object.keys(metadata.additionalFields).length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {Object.entries(metadata.additionalFields).map(([k, v]) => (
              <div
                key={k}
                className="bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-lg text-[11px] font-mono"
              >
                <span className="text-slate-400">{k}:</span>{' '}
                <span className="text-teal-300 font-semibold">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Details & Embedded Verification QR (FR-5.3) */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 items-center gap-6 border-t border-teal-500/20 pt-6 mt-8 text-xs text-slate-400">
        {/* Left: Issue Date & Expiry */}
        <div className="text-center sm:text-left space-y-1">
          <p className="font-semibold text-slate-300">Date of Issuance</p>
          <p className="font-mono text-slate-400">{formattedIssueDate}</p>
          {metadata.expiryDate && (
            <p className="text-[10px] text-amber-400/80">
              Expires:{' '}
              {new Date(metadata.expiryDate).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* Center: Official Seal & Signature simulation */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-teal-400/50 flex items-center justify-center p-1 mb-1 shadow-inner shadow-teal-500/20">
            <ShieldCheck className="w-7 h-7 text-teal-400" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400 font-semibold">
            On-Chain Verified
          </span>
        </div>

        {/* Right: Scannable Verification QR (FR-5.3, Decision 2.10) */}
        <div className="flex flex-col items-center sm:items-end text-center sm:text-right gap-1.5">
          <div className="bg-white p-1.5 rounded-lg shadow-md inline-block">
            <QRCodeSVG
              value={verificationUrl}
              size={68}
              level="M"
              includeMargin={false}
            />
          </div>
          <p className="text-[9px] font-mono text-slate-400 max-w-[120px] truncate">
            Scan to verify on-chain
          </p>
        </div>
      </div>

      {/* Proof Hash & CertId Footer bar */}
      <div className="relative z-10 mt-6 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono text-slate-400 gap-2">
        <span className="truncate max-w-sm">
          Proof Hash: <strong className="text-teal-400/90 font-mono">{displayCertId}</strong>
        </span>
        <span className="shrink-0 text-slate-400">CertiChain Protocol v1.0 • EVM + IPFS</span>
      </div>
    </div>

    {/* Export Controls Toolbar */}
    {showExportControls && (
      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3">
        <button
          onClick={handleExportPdf}
          disabled={isExportingPdf}
          className="btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5"
        >
          {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-teal-400" />}
          {isExportingPdf ? 'Generating PDF...' : 'Download PDF (Print-Ready A4)'}
        </button>

        <button
          onClick={handleExportPng}
          disabled={isExportingPng}
          className="btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5"
        >
          {isExportingPng ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />}
          {isExportingPng ? 'Generating PNG...' : 'Download PNG (High-Res)'}
        </button>
      </div>
    )}
  </div>
  );
};
