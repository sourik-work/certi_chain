import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { useToast } from '../hooks/useToast';
import { DEV_ACCOUNTS } from '../context/WalletContext';
import { X, Wallet, Sparkles, ExternalLink, Check, ShieldCheck, User } from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const {
    account,
    isConnected,
    isDevAccount,
    hasInjectedWallet,
    isConnecting,
    connect,
    connectDevAccount,
    disconnect,
  } = useWallet();
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleConnectInjected = async () => {
    try {
      await connect();
      showToast('success', 'Wallet Connected', 'Successfully connected to browser wallet.');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      showToast('error', 'Connection Error', msg);
    }
  };

  const handleConnectDev = async (address: string, label: string) => {
    try {
      await connectDevAccount(address);
      showToast('success', 'Dev Account Active', `Connected as ${label} (${address.slice(0, 8)}...)`);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Dev account connection failed';
      showToast('error', 'Dev Connection Failed', msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-teal-500/10 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Connect to CertiChain</h3>
              <p className="text-xs text-slate-400">Select a connection method to interact with the ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connection Options */}
        <div className="space-y-4">
          {/* 1. Local Hardhat Dev Accounts (Recommended for Localhost) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Instant Local Accounts (Hardhat Node)
              </span>
              <span className="text-[10px] text-teal-400/80 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                1-Click Ready
              </span>
            </div>

            <div className="space-y-2">
              {DEV_ACCOUNTS.map((dev) => {
                const isCurrent = isConnected && isDevAccount && account?.toLowerCase() === dev.address.toLowerCase();
                return (
                  <button
                    key={dev.address}
                    onClick={() => handleConnectDev(dev.address, dev.label)}
                    disabled={isConnecting}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                      isCurrent
                        ? 'bg-teal-950/40 border-teal-500/50 text-teal-100'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-teal-500/40 hover:bg-slate-800/50 text-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg mt-0.5 ${
                        dev.role === 'issuer'
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                          : 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
                      }`}>
                        {dev.role === 'issuer' ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{dev.label}</span>
                          {dev.role === 'issuer' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                              Issuer Whitelisted
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-xs">
                          {dev.address}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{dev.description}</p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="flex items-center gap-1 text-xs text-teal-400 font-semibold shrink-0">
                        <Check className="w-4 h-4" /> Active
                      </span>
                    ) : (
                      <span className="text-xs text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium shrink-0">
                        Connect →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-slate-900 px-2 text-slate-500 font-semibold tracking-widest">or Browser Extension</span>
            </div>
          </div>

          {/* 2. Injected Browser Wallet (MetaMask) */}
          <div>
            {hasInjectedWallet ? (
              <button
                onClick={handleConnectInjected}
                disabled={isConnecting}
                className="w-full p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/40 transition-all flex items-center justify-between text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-semibold block">Browser Extension (MetaMask)</span>
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Extension Detected
                    </span>
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {isConnected && !isDevAccount ? 'Connected' : 'Connect →'}
                </span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl border border-slate-800/90 bg-slate-950/40 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-slate-400" /> MetaMask Extension Not Detected
                  </span>
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium"
                  >
                    Install MetaMask <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  No Web3 extension was found in this browser. You can use the <strong className="text-teal-300">1-Click Local Accounts</strong> above to issue, sign, and verify credentials without installing anything.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Disconnect if connected */}
        {isConnected && (
          <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => {
                disconnect();
                showToast('info', 'Disconnected', 'Wallet disconnected.');
                onClose();
              }}
              className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-950/40 transition-colors"
            >
              Disconnect Current Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
