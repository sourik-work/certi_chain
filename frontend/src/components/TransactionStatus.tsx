import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, Hash, ArrowRight } from 'lucide-react';
import { CONFIG } from '../config';
import { Stepper, StepItem } from './ui/Stepper';

export type TxStep =
  | 'idle'
  | 'validating'
  | 'hashing'
  | 'pinning'
  | 'awaiting_signature'
  | 'mining'
  | 'confirmed'
  | 'error';

interface TransactionStatusProps {
  step: TxStep;
  txHash?: string;
  confirmations?: number;
  error?: string;
  certId?: string;
  onReset?: () => void;
  onViewCertificate?: (certId: string) => void;
}

const PIPELINE_STEPS: StepItem[] = [
  { id: 'hash', label: 'Canonical Hash', description: 'RFC 8785 SHA-256' },
  { id: 'pin', label: 'IPFS Pin', description: 'Decentralized CID' },
  { id: 'anchor', label: 'EVM Anchor', description: 'Smart contract mint' },
  { id: 'done', label: 'Confirmed', description: 'Ready on-chain' },
];

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  step,
  txHash,
  confirmations = 0,
  error,
  certId,
  onReset,
  onViewCertificate,
}) => {
  if (step === 'idle') return null;

  const explorerBaseUrl =
    CONFIG.targetChainId === 11155111
      ? 'https://sepolia.etherscan.io/tx/'
      : 'https://etherscan.io/tx/';

  let currentStepIdx = 0;
  let errorStepIdx: number | undefined = undefined;

  if (step === 'validating' || step === 'hashing') {
    currentStepIdx = 0;
  } else if (step === 'pinning') {
    currentStepIdx = 1;
  } else if (step === 'awaiting_signature' || step === 'mining') {
    currentStepIdx = 2;
  } else if (step === 'confirmed') {
    currentStepIdx = 4; // all done
  } else if (step === 'error') {
    errorStepIdx = currentStepIdx;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-card animate-in fade-in duration-200 space-y-6">
      {/* Horizontal Pipeline Stepper */}
      <div className="pb-4 border-b border-slate-100">
        <Stepper
          steps={PIPELINE_STEPS}
          currentStepIndex={currentStepIdx}
          errorStepIndex={errorStepIdx}
        />
      </div>

      <div className="flex items-start gap-4">
        {/* Status Indicator Icon */}
        <div className="mt-0.5 flex-shrink-0">
          {['validating', 'hashing', 'pinning', 'awaiting_signature', 'mining'].includes(step) && (
            <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-900 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          {step === 'confirmed' && (
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}
          {step === 'error' && (
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Content Details */}
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-bold text-navy-950">
            {step === 'validating' && 'Validating Schema & Sanitizing Input...'}
            {step === 'hashing' && 'Computing Cryptographic SHA-256 Proof Hash...'}
            {step === 'pinning' && 'Pinning Certificate Metadata to IPFS via Pinata...'}
            {step === 'awaiting_signature' && 'Waiting for Wallet Transaction Signature...'}
            {step === 'mining' && 'Confirming Transaction On-Chain...'}
            {step === 'confirmed' && 'Credential Successfully Registered On-Chain!'}
            {step === 'error' && 'Issuance Pipeline Error'}
          </h4>

          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {step === 'validating' && 'Checking schema constraints and neutralizing potential HTML/XSS vectors.'}
            {step === 'hashing' && 'Running RFC 8785 UTF-16 code unit key sorting and WebCrypto digest.'}
            {step === 'pinning' && 'Uploading canonical JSON metadata to decentralized IPFS node via secure proxy.'}
            {step === 'awaiting_signature' && 'Please confirm the issueCertificate transaction in your connected Web3 wallet.'}
            {step === 'mining' && `Waiting for block inclusion on Ethereum Sepolia. Current confirmations: ${confirmations}`}
            {step === 'confirmed' &&
              'The certificate proof hash is immutably anchored to the EVM CertificateRegistry contract.'}
            {step === 'error' && (error || 'An error occurred during transaction execution.')}
          </p>

          {/* Transaction Hash & Block Explorer Details */}
          {txHash && (
            <div className="mt-3 flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs font-mono">
              <span className="text-slate-600 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-navy-900" />
                Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </span>

              {CONFIG.targetChainId === 11155111 && (
                <a
                  href={`${explorerBaseUrl}${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-azure-700 hover:text-navy-900 font-bold flex items-center gap-1 transition-colors font-sans"
                >
                  View on Etherscan <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Action buttons on completion */}
          {step === 'confirmed' && (
            <div className="mt-4 flex flex-wrap gap-2.5 pt-2">
              {certId && onViewCertificate && (
                <button
                  onClick={() => onViewCertificate(certId)}
                  className="btn-primary"
                >
                  <span>View in Verification Portal</span>
                  <ArrowRight size={14} />
                </button>
              )}
              {onReset && (
                <button onClick={onReset} className="btn-secondary">
                  Issue Another Certificate
                </button>
              )}
            </div>
          )}

          {step === 'error' && onReset && (
            <div className="mt-4 pt-2">
              <button onClick={onReset} className="btn-secondary">
                Dismiss & Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
