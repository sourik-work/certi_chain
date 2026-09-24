import React, { useState } from 'react';
import { VerificationResultData } from '../types/certificate';
import { CertificatePreview } from './CertificatePreview';
import {
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  ExternalLink,
  Copy,
  Check,
  QrCode as QrCodeIcon,
  Shield,
  FileCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface VerificationResultProps {
  result: VerificationResultData;
  onRevokeClick?: () => void;
  canRevoke?: boolean;
}

export const VerificationResult: React.FC<VerificationResultProps> = ({
  result,
  onRevokeClick,
  canRevoke = false,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const verificationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify/${result.certId}`
    : `https://certichain.ledger/verify/${result.certId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formattedIssuedDate = result.onChain?.issuedAt
    ? new Date(Number(result.onChain.issuedAt) * 1000).toLocaleString()
    : 'Unknown';

  const formattedRevokedDate = result.onChain?.revokedAt
    ? new Date(Number(result.onChain.revokedAt) * 1000).toLocaleString()
    : 'Unknown';

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
      {/* Tri-State Verification Banner */}
      <div
        className={`p-6 sm:p-8 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all ${
          result.state === 'VALID'
            ? 'bg-emerald-950/40 border-emerald-500/40 shadow-emerald-500/10'
            : result.state === 'REVOKED'
            ? 'bg-rose-950/40 border-rose-500/40 shadow-rose-500/10'
            : 'bg-amber-950/40 border-amber-500/40 shadow-amber-500/10'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className={`p-3.5 rounded-2xl shrink-0 ${
                result.state === 'VALID'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : result.state === 'REVOKED'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}
            >
              {result.state === 'VALID' && <CheckCircle className="w-8 h-8" />}
              {result.state === 'REVOKED' && <AlertOctagon className="w-8 h-8" />}
              {result.state === 'INVALID_TAMPERED' && <AlertTriangle className="w-8 h-8" />}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h2
                  data-testid="verification-status-heading"
                  className={`text-2xl font-bold tracking-tight ${
                    result.state === 'VALID'
                      ? 'text-emerald-300'
                      : result.state === 'REVOKED'
                      ? 'text-rose-300'
                      : 'text-amber-300'
                  }`}
                >
                  {result.state === 'VALID' && 'AUTHENTIC & VALID CREDENTIAL'}
                  {result.state === 'REVOKED' && 'CREDENTIAL HAS BEEN REVOKED'}
                  {result.state === 'INVALID_TAMPERED' && 'INVALID OR TAMPERED RECORD'}
                </h2>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed max-w-2xl">
                {result.state === 'VALID' &&
                  'Cryptographic SHA-256 integrity verified. The payload bytes match the on-chain proof hash exactly, issued by an authorized entity.'}
                {result.state === 'REVOKED' &&
                  `This certificate was revoked on ${formattedRevokedDate}. It is no longer valid.`}
                {result.state === 'INVALID_TAMPERED' &&
                  (result.errorReason ||
                    'The certificate proof hash does not match the computed hash of the IPFS metadata, indicating data modification or an unanchored ID.')}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
            <button
              onClick={handleCopyLink}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Link Copied!' : 'Share Verification Link'}
            </button>

            <button
              onClick={() => setShowQrModal(true)}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
            >
              <QrCodeIcon className="w-3.5 h-3.5" />
              QR Code
            </button>

            {canRevoke && result.state === 'VALID' && onRevokeClick && (
              <button
                onClick={onRevokeClick}
                className="btn-danger py-2 px-3 text-xs flex items-center gap-1.5"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Revoke Credential
              </button>
            )}
          </div>
        </div>

        {/* Audit Meta Grid */}
        {result.onChain && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-xs">
            <div>
              <p className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                Issuer Authority
              </p>
              <div className="flex items-center gap-1.5 mt-1 font-mono text-slate-300">
                <span className="truncate">{result.onChain.issuer}</span>
              </div>
              <div className="mt-1">
                {result.isIssuerAuthorized ? (
                  <span className="badge-valid text-[10px] py-0.5 px-2">
                    <Shield className="w-3 h-3" /> Authorized Whitelist
                  </span>
                ) : (
                  <span className="badge-tampered text-[10px] py-0.5 px-2">
                    Unverified Authority
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                On-Chain Registration Date
              </p>
              <p className="mt-1 font-mono text-slate-300">{formattedIssuedDate}</p>
            </div>

            <div>
              <p className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                Proof Hash (certId)
              </p>
              <p className="mt-1 font-mono text-teal-400 truncate" title={result.certId}>
                {result.certId}
              </p>
            </div>

            <div>
              <p className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                Decentralized Metadata
              </p>
              <a
                href={result.onChain.metadataUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 text-teal-400 hover:text-teal-300 flex items-center gap-1 font-mono transition-colors"
              >
                <FileCode className="w-3.5 h-3.5" />
                Raw IPFS JSON <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Render Full Visual Certificate if metadata exists */}
      {result.metadata && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Rendered Certificate Asset
          </h3>
          <CertificatePreview
            metadata={result.metadata}
            proofHash={result.computedProofHash || result.certId}
            certId={result.certId}
            isRevoked={result.state === 'REVOKED'}
            revocationTimestamp={result.onChain?.revokedAt}
            isAuthorizedIssuer={result.isIssuerAuthorized}
          />
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 max-w-sm w-full text-center space-y-4">
            <h3 className="text-base font-bold text-slate-100">Verification QR Code</h3>
            <p className="text-xs text-slate-400">
              Scan with any mobile device to inspect on-chain authenticity in realtime.
            </p>
            <div className="bg-white p-4 rounded-2xl shadow-xl inline-block mx-auto">
              <QRCodeSVG value={verificationUrl} size={180} level="H" />
            </div>
            <p className="text-[11px] font-mono text-teal-400 break-all">{verificationUrl}</p>
            <button onClick={() => setShowQrModal(false)} className="btn-secondary w-full py-2 text-xs">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
