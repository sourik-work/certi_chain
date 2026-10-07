/**
 * Custom Certificate Issuance Progress Component
 * Tracks multi-stage issuance pipeline:
 * 1. Uploading Template File -> 2. Rendering High-Res PNG -> 3. Pinning IPFS Metadata -> 4. Wallet Signature -> 5. On-Chain Confirmation -> 6. Complete
 */

import React, { useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle, RefreshCw, ExternalLink, ShieldCheck, Copy, Check } from 'lucide-react';

export type CustomIssueStage =
  | 'idle'
  | 'uploading_template'
  | 'rendering_certificate'
  | 'pinning_metadata'
  | 'awaiting_signature'
  | 'confirming_tx'
  | 'confirmed'
  | 'error';

export interface CustomErrorDetails {
  readonly code: string;
  readonly technicalDetail: string;
  readonly requestId?: string;
  readonly statusCode?: number;
}

interface IssueProgressProps {
  stage: CustomIssueStage;
  error?: string | null;
  errorDetails?: CustomErrorDetails | null;
  txHash?: string | null;
  certId?: string | null;
  templateCid?: string | null;
  baseCid?: string | null;
  renderedCid?: string | null;
  metadataCid?: string | null;
  onRetry: () => void;
  onViewCertificate: (id: string) => void;
}

const STAGES: Array<{ id: CustomIssueStage; label: string; desc: string }> = [
  { id: 'uploading_template', label: 'Pin Template', desc: 'Binary asset to IPFS' },
  { id: 'rendering_certificate', label: 'Render PNG', desc: 'Deterministic 1920px image' },
  { id: 'pinning_metadata', label: 'Pin Metadata', desc: 'Canonical RFC 8785 JSON' },
  { id: 'awaiting_signature', label: 'Wallet Signature', desc: 'Confirm in MetaMask' },
  { id: 'confirming_tx', label: 'EVM Anchor', desc: 'Mining smart contract tx' },
  { id: 'confirmed', label: 'Complete', desc: 'Anchored & Verifiable' },
];

export const IssueProgress: React.FC<IssueProgressProps> = ({
  stage,
  error,
  errorDetails,
  txHash,
  certId,
  templateCid,
  baseCid,
  renderedCid,
  metadataCid,
  onRetry,
  onViewCertificate,
}) => {
  const [copiedDebug, setCopiedDebug] = useState(false);

  if (stage === 'idle') return null;

  const currentIdx = STAGES.findIndex((s) => s.id === stage);

  const handleCopyDebug = () => {
    const debugPayload = {
      stage,
      errorMessage: error,
      errorCode: errorDetails?.code || 'UNKNOWN_ERROR',
      technicalDetail: errorDetails?.technicalDetail,
      requestId: errorDetails?.requestId || 'N/A',
      timestamp: new Date().toISOString(),
      appOrigin: typeof window !== 'undefined' ? window.location.origin : '',
      activeNetwork: typeof window !== 'undefined' ? 'configured-chain' : '',
    };
    navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2));
    setCopiedDebug(true);
    setTimeout(() => setCopiedDebug(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-card space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-navy-950 dark:text-white font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-azure-600" />
          <span>Issuance & Blockchain Anchoring Pipeline</span>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {stage === 'confirmed' ? 'Successfully Anchored' : stage === 'error' ? 'Pipeline Error' : 'In Progress'}
        </span>
      </div>

      {/* Stepper Dots */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAGES.map((s, idx) => {
          const isDone = stage === 'confirmed' || (currentIdx > idx && stage !== 'error');
          const isCurrent = s.id === stage;
          const isFailed = stage === 'error' && isCurrent;

          return (
            <div
              key={s.id}
              className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 transition-all ${
                isDone
                  ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                  : isCurrent
                  ? 'border-azure-500 bg-azure-50/60 dark:bg-azure-950/40 text-azure-950 dark:text-azure-200 ring-2 ring-azure-500/20'
                  : isFailed
                  ? 'border-rose-400 bg-rose-50 text-rose-900'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-900/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold">{idx + 1}</span>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-azure-600 animate-spin" />
                ) : isFailed ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : null}
              </div>

              <div>
                <div className="font-bold text-xs">{s.label}</div>
                <div className="text-[10px] text-slate-500 truncate">{s.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Description Banner */}
      {stage === 'error' ? (
        <div className="p-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200 rounded-2xl space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-sm">Issuance Pipeline Blocked</strong>
                <p className="text-rose-800 dark:text-rose-300 mt-0.5 font-medium">
                  {error || 'An unexpected error occurred during execution.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="btn-primary text-xs shrink-0 flex items-center gap-1.5 py-1.5 px-3.5 bg-rose-700 hover:bg-rose-800"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Pipeline
            </button>
          </div>

          {errorDetails && (
            <div className="p-3 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-rose-200 dark:border-rose-800 text-[11px] font-mono space-y-1">
              <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-rose-100 dark:border-rose-900">
                <span>Error Code: <strong>{errorDetails.code}</strong></span>
                {errorDetails.requestId && <span>ReqID: {errorDetails.requestId}</span>}
              </div>
              <p className="text-slate-700 dark:text-slate-300 pt-0.5">{errorDetails.technicalDetail}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              {errorDetails?.code === 'PIN_CONFIG_MISSING'
                ? 'Tip: Add PINATA_JWT to your serverless environment or use dev proxy.'
                : errorDetails?.code === 'PIN_UNAUTHORIZED' || errorDetails?.code === 'PIN_NOT_ISSUER'
                ? 'Tip: Check wallet authorization on the smart contract.'
                : 'Tip: Click Retry to resume from the last successful stage.'}
            </span>
            <button
              type="button"
              onClick={handleCopyDebug}
              className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 flex items-center gap-1 font-medium bg-white/80 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              {copiedDebug ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copiedDebug ? 'Copied Details' : 'Copy Debug Details'}</span>
            </button>
          </div>
        </div>
      ) : stage === 'confirmed' ? (
        <div className="p-5 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Certificate Successfully Anchored On-Chain!</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-emerald-900">
            {certId && <div>Cert ID: <strong className="font-bold">{certId.slice(0, 14)}...</strong></div>}
            {txHash && <div>Tx Hash: <strong className="font-bold">{txHash.slice(0, 14)}...</strong></div>}
            {templateCid && <div>Template CID: <span className="text-slate-600">{templateCid.slice(0, 14)}...</span></div>}
            {baseCid && <div>Base CID: <span className="text-slate-600">{baseCid.slice(0, 14)}...</span></div>}
            {renderedCid && <div>Rendered CID: <span className="text-slate-600">{renderedCid.slice(0, 14)}...</span></div>}
            {metadataCid && <div>Metadata CID: <span className="text-slate-600">{metadataCid.slice(0, 14)}...</span></div>}
          </div>

          <div className="pt-2 flex justify-end">
            {certId && (
              <button
                type="button"
                onClick={() => onViewCertificate(certId)}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <span>Open Verification Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-azure-600" />
          <span>Processing step: {STAGES[currentIdx]?.label} — please wait...</span>
        </div>
      )}
    </div>
  );
};
