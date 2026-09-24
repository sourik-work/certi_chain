import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { CONFIG } from '../config';
import { AlertTriangle, ArrowRightLeft } from 'lucide-react';

export const NetworkGuard: React.FC = () => {
  const { isConnected, isCorrectNetwork, chainId, switchNetwork } = useWallet();

  if (!isConnected || isCorrectNetwork) {
    return null;
  }

  return (
    <div className="bg-amber-950/80 border-b border-amber-600/50 px-4 py-3 text-amber-200 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            <strong>Wrong Network Detected:</strong> You are currently connected to Chain ID{' '}
            <code className="bg-amber-900/50 px-1.5 py-0.5 rounded font-mono text-xs text-amber-300">
              {chainId ?? 'Unknown'}
            </code>
            . CertiChain Ledger requires{' '}
            <strong>{CONFIG.targetChainName}</strong> (Chain ID {CONFIG.targetChainId}).
          </span>
        </div>
        <button
          onClick={() => switchNetwork()}
          className="btn-primary py-1.5 px-3.5 text-xs bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-semibold flex items-center gap-1.5 shrink-0"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Switch to {CONFIG.targetChainName}
        </button>
      </div>
    </div>
  );
};
