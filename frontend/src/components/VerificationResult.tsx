import React, { useState } from 'react';
import { VerificationResultData } from '../types/certificate';
import { CertificateView } from './CertificateView';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ExternalLink,
  Copy,
  Check,
  QrCode as QrCodeIcon,
  Shield,
  FileCode,
  ChevronDown,
  Info,
  X,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface VerificationResultProps {
  result: VerificationResultData;
  onRevokeClick?: () => void;
  canRevoke?: boolean;
  onRetry?: () => void;
}

export const VerificationResult: React.FC<VerificationResultProps> = ({
  result,
  onRevokeClick,
  canRevoke = false,
  onRetry,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const targetChainParam = result.chainId ? `?chain=${result.chainId}` : '';
  const verificationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify/${result.certId}${targetChainParam}`
    : `https://certichain.ledger/verify/${result.certId}${targetChainParam}`;

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
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Quad-State Verification Banner Card */}
      <div
        className={`rounded-2xl border p-6 sm:p-8 shadow-card bg-white ${
          result.state === 'VALID'
            ? 'border-emerald-300'
            : result.state === 'REVOKED'
            ? 'border-rose-300'
            : result.state === 'INVALID_TAMPERED'
            ? 'border-rose-400'
            : result.state === 'NO_CONTRACT' || result.state === 'UNREACHABLE'
            ? 'border-amber-400'
            : 'border-amber-300'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className={`p-3.5 rounded-2xl shrink-0 ${
                result.state === 'VALID'
                  ? 'bg-emerald-100 text-emerald-700'
                  : result.state === 'REVOKED'
                  ? 'bg-rose-100 text-rose-700'
                  : result.state === 'INVALID_TAMPERED'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {result.state === 'VALID' && <CheckCircle2 className="w-8 h-8" />}
              {result.state === 'REVOKED' && <AlertOctagon className="w-8 h-8" />}
              {result.state === 'INVALID_TAMPERED' && <AlertOctagon className="w-8 h-8" />}
              {result.state === 'INVALID_UNVERIFIABLE' && <AlertTriangle className="w-8 h-8" />}
              {(result.state === 'UNVERIFIABLE' || result.state === 'NOT_FOUND' || result.state === 'NO_CONTRACT' || result.state === 'UNREACHABLE') && (
                <AlertTriangle className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2
                  data-testid="verification-status-heading"
                  className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
                    result.state === 'VALID'
                      ? 'text-emerald-800'
                      : result.state === 'REVOKED'
                      ? 'text-rose-800'
                      : result.state === 'INVALID_TAMPERED'
                      ? 'text-rose-800'
                      : 'text-amber-900'
                  }`}
                >
                  {result.state === 'VALID' && 'AUTHENTIC & VALID CREDENTIAL'}
                  {result.state === 'REVOKED' && 'CREDENTIAL HAS BEEN REVOKED'}
                  {result.state === 'INVALID_TAMPERED' && 'INVALID OR TAMPERED RECORD'}
                  {result.state === 'INVALID_UNVERIFIABLE' && 'ARTIFACT UNVERIFIABLE (IPFS UNREACHABLE)'}
                  {result.state === 'UNVERIFIABLE' && 'METADATA UNREACHABLE / UNVERIFIABLE'}
                  {result.state === 'NOT_FOUND' && 'CERTIFICATE NOT FOUND'}
                  {result.state === 'NO_CONTRACT' && 'NO REGISTRY CONTRACT FOUND'}
                  {result.state === 'UNREACHABLE' && 'REGISTRY UNREACHABLE'}
                </h2>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed max-w-2xl font-normal">
                {result.state === 'VALID' &&
                  'Cryptographic SHA-256 integrity verified. The payload bytes match the on-chain proof hash exactly, issued by an authorized entity.'}
                {result.state === 'REVOKED' &&
                  `This certificate was revoked on ${formattedRevokedDate}. It is no longer valid.`}
                {result.state === 'INVALID_TAMPERED' &&
                  (result.errorReason ||
                    'The certificate proof hash does not match the computed hash of the IPFS metadata, indicating data modification or an unanchored ID.')}
                {result.state === 'INVALID_UNVERIFIABLE' &&
                  (result.errorReason ||
                    'The on-chain certificate record and issuer authority are valid, but decentralized template or rendered image bytes could not be retrieved from IPFS gateways.')}
                {result.state === 'UNVERIFIABLE' &&
                  (result.errorReason ||
                    'Certificate metadata could not be retrieved from decentralized IPFS gateways. Verification cannot complete without metadata payload.')}
                {result.state === 'NOT_FOUND' &&
                  (result.errorReason || 'No on-chain certificate record was found for this identifier.')}
                {result.state === 'NO_CONTRACT' &&
                  (result.errorReason || `No contract found at registry address on this network.`)}
                {result.state === 'UNREACHABLE' &&
                  (result.errorReason || `Unable to reach the registry RPC. Check your connection or retry.`)}
              </p>

              {/* Requirement 2.2: Checked on line */}
              {result.chainName && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-slate-500">
                  <span className="flex items-center gap-1 font-semibold text-navy-950">
                    <Globe className="w-3.5 h-3.5 text-azure-700" />
                    Checked on: {result.chainName}
                  </span>
                  {result.registryAddress && (
                    <span className="text-slate-500">
                      (Registry: <code className="text-navy-900 font-bold">{result.registryAddress.slice(0, 10)}...{result.registryAddress.slice(-6)}</code>)
                    </span>
                  )}
                </div>
              )}

              {/* Requirement 2.2: Neutral wallet chain mismatch note */}
              {result.walletChainMismatch && (
                <div className="mt-2 text-[11px] bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-azure-600 shrink-0" />
                  <span>
                    Note: Your connected wallet is on <strong>{result.walletChainName || 'another network'}</strong>. The certificate was verified against <strong>{result.chainName}</strong>.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
            {(result.state === 'UNREACHABLE' || result.state === 'UNVERIFIABLE' || result.state === 'NO_CONTRACT') && onRetry && (
              <button
                onClick={onRetry}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Verification</span>
              </button>
            )}

            <button
              onClick={handleCopyLink}
              className="btn-secondary text-xs"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
            </button>

            <button
              onClick={() => setShowQrModal(true)}
              className="btn-secondary text-xs"
            >
              <QrCodeIcon className="w-3.5 h-3.5 text-navy-900" />
              <span>QR Code</span>
            </button>

            {canRevoke && result.state === 'VALID' && onRevokeClick && (
              <button
                onClick={onRevokeClick}
                className="btn-danger text-xs"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Revoke Credential</span>
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Definition List & Audit Details */}
        {result.onChain && result.onChain.issuedAt > 0n && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
            <div>
              <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                Issuer Authority
              </p>
              <div className="flex items-center gap-1.5 mt-1 font-mono text-slate-800">
                <span className="truncate">{result.onChain.issuer}</span>
              </div>
              <div className="mt-1.5">
                {result.isIssuerAuthorized ? (
                  <span className="badge-valid text-[10px] py-0.5 px-2">
                    <Shield className="w-3 h-3 text-emerald-600" /> Authorized Whitelist
                  </span>
                ) : (
                  <span className="badge-tampered text-[10px] py-0.5 px-2">
                    Unverified Authority
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                Registration Timestamp
              </p>
              <p className="mt-1 font-semibold text-slate-800">{formattedIssuedDate}</p>
            </div>

            <div>
              <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                Proof Hash (certId)
              </p>
              <p className="mt-1 font-mono text-navy-900 font-bold truncate" title={result.certId}>
                {result.certId}
              </p>
            </div>

            <div>
              <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                Decentralized Metadata
              </p>
              <a
                href={result.onChain.metadataUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 text-azure-700 hover:text-navy-950 font-bold flex items-center gap-1 transition-colors"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Raw IPFS JSON</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Collapsible Technical Details Accordion */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={() => setShowTechDetails(!showTechDetails)}
            className="text-xs font-bold text-slate-600 hover:text-navy-950 flex items-center gap-1.5"
            aria-expanded={showTechDetails}
          >
            <Info size={14} className="text-azure-600" />
            <span>Technical Verification Details</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${showTechDetails ? 'rotate-180' : ''}`} />
          </button>

          {showTechDetails && (
            <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs font-mono text-slate-700 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500 font-sans font-medium">Target Network:</span>
                <span className="text-navy-950 font-bold truncate">{result.chainName} ({result.chainId})</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500 font-sans font-medium">Registry Contract:</span>
                <span className="text-navy-950 font-bold truncate">{result.registryAddress}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500 font-sans font-medium">On-Chain Proof Hash:</span>
                <span className="text-navy-950 font-bold truncate">{result.certId}</span>
              </div>
              {result.computedProofHash && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-sans font-medium">Recomputed Payload Hash:</span>
                  <span className="text-emerald-700 font-bold truncate">{result.computedProofHash}</span>
                </div>
              )}
              {result.onChain?.metadataUrl && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-sans font-medium">IPFS Gateway Target:</span>
                  <span className="truncate text-slate-800">{result.onChain.metadataUrl}</span>
                </div>
              )}
              {result.customIntegrity && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-sans font-medium">Custom Template Integrity:</span>
                  <span className={result.customIntegrity.valid ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                    {result.customIntegrity.valid ? '✓ Verified Intact' : '✗ Tampered / Mismatch'}
                  </span>
                </div>
              )}
              {result.metadata?.custom && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-sans font-medium">Template SHA-256:</span>
                  <span className="truncate text-slate-800 font-bold">{result.metadata.custom.templateHash.slice(0, 18)}...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Render Full Visual Certificate if metadata exists */}
      {result.metadata && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-navy-950">
              Rendered Official Credential
            </h3>
            <span className="text-xs text-slate-500">
              {result.renderedDataUrl ? 'Verified Artifact' : 'Live Visual Engine'}
            </span>
          </div>
          <CertificateView
            metadata={result.metadata}
            templateSpec={result.templateSpec}
            templateValues={result.metadata.templateValues}
            renderedDataUrl={result.renderedDataUrl}
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
        <div className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-floating">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-navy-950">Verification QR Code</h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
                aria-label="Close QR modal"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Scan with any mobile device or QR scanner to verify on-chain authenticity instantly on {result.chainName}.
            </p>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm inline-block mx-auto">
              <QRCodeSVG value={verificationUrl} size={180} level="H" />
            </div>
            <p className="text-[11px] font-mono text-navy-900 break-all bg-slate-50 p-2 rounded-lg border border-slate-200">
              {verificationUrl}
            </p>
            <button onClick={() => setShowQrModal(false)} className="btn-secondary w-full">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

