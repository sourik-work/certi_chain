import React from 'react';
import { Loader2, CheckCircle, AlertCircle, ExternalLink, Hash } from 'lucide-react';
import { CONFIG } from '../config';

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

  return (
    <div className="glass-panel p-6 border-teal-500/30 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-start gap-4">
        {/* Status Indicator Icon */}
        <div className="mt-1">
          {['validating', 'hashing', 'pinning', 'awaiting_signature', 'mining'].includes(step) && (
            <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
          )}
          {step === 'confirmed' && <CheckCircle className="w-6 h-6 text-emerald-400" />}
          {step === 'error' && <AlertCircle className="w-6 h-6 text-rose-400" />}
        </div>

        {/* Content Details */}
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold text-slate-100">
            {step === 'validating' && 'Validating Schema & Sanitizing Input...'}
            {step === 'hashing' && 'Computing Cryptographic SHA-256 Proof Hash...'}
            {step === 'pinning' && 'Pinning Certificate Metadata to IPFS via Pinata...'}
            {step === 'awaiting_signature' && 'Waiting for Wallet Transaction Signature...'}
            {step === 'mining' && 'Confirming Transaction On-Chain...'}
            {step === 'confirmed' && 'Credential Successfully Registered On-Chain!'}
            {step === 'error' && 'Issuance Failed'}
          </h4>

          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {step === 'validating' && 'Checking schema v1.0 constraints and neutralizing XSS vectors.'}
            {step === 'hashing' && 'Running RFC 8785 UTF-16 code unit key sorting and WebCrypto digest.'}
            {step === 'pinning' && 'Uploading canonical JSON to decentralized IPFS node.'}
            {step === 'awaiting_signature' && 'Please confirm the issueCertificate transaction in MetaMask.'}
            {step === 'mining' && `Waiting for block inclusion. Current confirmations: ${confirmations}`}
            {step === 'confirmed' &&
              'The certificate proof hash is immutably anchored to the EVM CertificateRegistry contract.'}
            {step === 'error' && (error || 'An error occurred during transaction execution.')}
          </p>

          {/* Transaction Hash & Block Explorer Details */}
          {txHash && (
            <div className="mt-3 flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-teal-400" />
                Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </span>

              {CONFIG.targetChainId === 11155111 && (
                <a
                  href={`${explorerBaseUrl}${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors"
                >
                  View on Etherscan <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Action buttons on completion */}
          {step === 'confirmed' && (
            <div className="mt-4 flex flex-wrap gap-2 pt-2">
              {certId && onViewCertificate && (
                <button
                  onClick={() => onViewCertificate(certId)}
                  className="btn-primary py-1.5 px-3 text-xs"
                >
                  View in Verification Portal
                </button>
              )}
              {onReset && (
                <button onClick={onReset} className="btn-secondary py-1.5 px-3 text-xs">
                  Issue Another Certificate
                </button>
              )}
            </div>
          )}

          {step === 'error' && onReset && (
            <div className="mt-4 pt-2">
              <button onClick={onReset} className="btn-secondary py-1.5 px-3 text-xs">
                Dismiss & Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
