import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { CONFIG } from '../config';
import { AlertTriangle, ArrowRightLeft } from 'lucide-react';

export const NetworkGuard: React.FC = () => {
  const { isConnected, isCorrectNetwork, chainId, switchNetwork } = useWallet();

  const isSupportedNetwork = chainId === 11155111 || chainId === 31337 || isCorrectNetwork;

  if (!isConnected || isSupportedNetwork) {
    return null;
  }

  return (
    <aside aria-label="Wrong network warning" className="bg-amber-50 border-b border-amber-300 px-4 py-3 text-amber-900 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            <strong>Wrong Network Detected:</strong> You are connected to Chain ID{' '}
            <code className="bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-mono text-xs text-amber-950 font-bold">
              {chainId ?? 'Unknown'}
            </code>
            . CertiChain requires{' '}
            <strong>{CONFIG.targetChainName}</strong> (Chain ID {CONFIG.targetChainId}).
          </span>
        </div>
        <button
          onClick={() => switchNetwork()}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-colors shrink-0"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Switch to {CONFIG.targetChainName}
        </button>
      </div>
    </aside>
  );
};
