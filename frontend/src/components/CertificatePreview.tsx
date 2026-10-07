import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CertificateMetadata } from '../types/certificate';
import { exportToPdf, exportToPng } from '../lib/export';
import { ShieldCheck, Award, AlertOctagon, CheckCircle2, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { getDefaultChainId } from '../config';

interface CertificatePreviewProps {
  metadata: Partial<CertificateMetadata>;
  proofHash?: string;
  certId?: string;
  chainId?: number;
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
  chainId,
  isRevoked = false,
  revocationReason,
  revocationTimestamp,
  isAuthorizedIssuer = true,
  showExportControls = true,
  id = 'certificate-preview-node',
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const activeChain = chainId || getDefaultChainId();
  const displayCertId = certId || proofHash || '0x0000000000000000000000000000000000000000000000000000000000000000';
  const verificationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify/${displayCertId}?chain=${activeChain}`
    : `https://certichain.ledger/verify/${displayCertId}?chain=${activeChain}`;

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
    : 'October 1, 2026';

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
      {/* Printable / Canvas Certificate Node */}
      <div
        id={id}
        className="relative w-full max-w-4xl mx-auto bg-white text-slate-900 rounded-2xl p-6 sm:p-10 lg:p-12 shadow-card border-4 border-navy-950 overflow-hidden select-none"
      >
        {/* Decorative Institutional Inner Borders */}
        <div className="absolute top-2 left-2 right-2 bottom-2 border-2 border-gold-500/60 rounded-xl pointer-events-none" />
        <div className="absolute top-3.5 left-3.5 right-3.5 bottom-3.5 border border-slate-200 rounded-lg pointer-events-none" />

        {/* Revocation Watermark Overlay if Revoked */}
        {isRevoked && (
          <div className="absolute inset-0 bg-rose-950/70 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <div className="bg-white border-2 border-rose-600 px-6 py-5 rounded-2xl shadow-floating max-w-md">
              <div className="flex items-center justify-center gap-2 text-rose-700 font-bold text-lg mb-1 uppercase tracking-wider">
                <AlertOctagon className="w-6 h-6" />
                Certificate Revoked
              </div>
              {revocationReason && (
                <p className="text-xs sm:text-sm text-slate-700 mt-2 font-medium">
                  <strong>Reason:</strong> {revocationReason}
                </p>
              )}
              {formattedRevokeDate && (
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  Revoked on: {formattedRevokeDate}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Header / Institution Banner */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-slate-100 pb-5 mb-6 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-900 text-white flex items-center justify-center shadow-md flex-shrink-0">
              <Award className="w-7 h-7 text-gold-400" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-navy-950 tracking-wide">
                {metadata.issuerName || 'CertiChain Academic Registry'}
              </h3>
              <p className="text-[11px] font-mono text-slate-500">
                Issuer Address:{' '}
                <span className="text-slate-800 font-semibold">
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
              <span className="badge-valid">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Issuer</span>
              </span>
            ) : (
              <span className="badge-tampered">
                <span>Unverified Issuer</span>
              </span>
            )}
          </div>
        </div>

        {/* Main Certificate Body */}
        <div className="relative z-10 text-center space-y-4 my-6">
          <p className="text-xs uppercase tracking-[0.25em] font-bold text-azure-700 font-sans">
            Official Verifiable Credential
          </p>

          <p className="text-xs text-slate-500 italic font-serif">This credential is conferred upon</p>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-extrabold text-navy-950 px-4 py-1 tracking-tight">
            {metadata.recipientName || 'Recipient Full Name'}
          </h1>

          <p className="text-xs font-mono text-slate-500">
            Holder Address / ID:{' '}
            <span className="text-navy-900 font-bold">
              {metadata.recipientIdentifier || '0x7099...79C8'}
            </span>
          </p>

          <div className="w-24 h-0.5 bg-navy-900 mx-auto my-3" />

          <div className="max-w-2xl mx-auto space-y-2">
            <p className="text-xs text-slate-500">in recognition of fulfilling all formal requirements for</p>
            <h2 className="text-xl sm:text-2xl font-bold text-navy-950 font-serif tracking-normal">
              {metadata.certificateTitle || 'Master in Blockchain Architecture & Security'}
            </h2>
            {metadata.description && (
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed pt-1">
                {metadata.description}
              </p>
            )}
          </div>

          {/* Additional Custom Fields */}
          {metadata.additionalFields && Object.keys(metadata.additionalFields).length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {Object.entries(metadata.additionalFields).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg text-[11px] font-mono shadow-sm"
                >
                  <span className="text-slate-500">{k}:</span>{' '}
                  <span className="text-navy-950 font-bold">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Details & Embedded Verification QR */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 items-center gap-6 border-t-2 border-slate-100 pt-6 mt-8 text-xs text-slate-600">
          {/* Left: Issue Date & Expiry */}
          <div className="text-center sm:text-left space-y-1">
            <p className="font-bold text-navy-950">Date of Issuance</p>
            <p className="font-mono text-slate-700">{formattedIssueDate}</p>
            {metadata.expiryDate && (
              <p className="text-[10px] text-amber-700">
                Expires:{' '}
                {new Date(metadata.expiryDate).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>

          {/* Center: Official Seal & Signature Placeholder */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full border-2 border-navy-900 bg-slate-50 flex items-center justify-center p-1 mb-1 shadow-sm">
              <ShieldCheck className="w-7 h-7 text-navy-900" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-navy-950 font-bold">
              On-Chain Verified
            </span>
          </div>

          {/* Right: Scannable Verification QR */}
          <div className="flex flex-col items-center sm:items-end text-center sm:text-right gap-1.5">
            <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm inline-block">
              <QRCodeSVG
                value={verificationUrl}
                size={68}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-[9px] font-mono text-slate-500 max-w-[120px] truncate">
              Scan to verify on-chain
            </p>
          </div>
        </div>

        {/* Proof Hash & CertId Footer bar */}
        <div className="relative z-10 mt-6 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono text-slate-500 gap-2">
          <span className="truncate max-w-sm">
            Proof Hash: <strong className="text-navy-950 font-mono">{displayCertId}</strong>
          </span>
          <span className="shrink-0 text-slate-400">CertiChain Protocol • EVM + IPFS</span>
        </div>
      </div>

      {/* Export Controls Toolbar */}
      {showExportControls && (
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="btn-secondary"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-navy-900" />}
            <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF (Print-Ready A4)'}</span>
          </button>

          <button
            onClick={handleExportPng}
            disabled={isExportingPng}
            className="btn-secondary"
          >
            {isExportingPng ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4 text-azure-600" />}
            <span>{isExportingPng ? 'Generating PNG...' : 'Download PNG (High-Res)'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
