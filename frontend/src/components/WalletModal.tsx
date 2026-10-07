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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-floating p-6 overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center shadow-sm">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy-950">Connect to CertiChain</h3>
              <p className="text-xs text-slate-500">Select an authorized connection method or test account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connection Options */}
        <div className="space-y-4">
          {/* 1. Local Hardhat Dev Accounts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-gold-500" /> Instant Local Test Accounts
              </span>
              <span className="text-[10px] text-navy-900 bg-navy-50 px-2 py-0.5 rounded-full border border-navy-200 font-semibold">
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
                        ? 'bg-navy-50 border-navy-900/40 text-navy-950 ring-1 ring-navy-900/30'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg mt-0.5 ${
                        dev.role === 'issuer'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {dev.role === 'issuer' ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-navy-950">{dev.label}</span>
                          {dev.role === 'issuer' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                              Issuer Whitelisted
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-xs">
                          {dev.address}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{dev.description}</p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-700 font-bold shrink-0 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">
                        <Check className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="text-xs text-azure-700 opacity-0 group-hover:opacity-100 transition-opacity font-bold shrink-0">
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
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 text-slate-400 font-bold tracking-widest">or Injected Web3 Provider</span>
            </div>
          </div>

          {/* 2. Injected Browser Wallet (MetaMask) */}
          <div>
            {hasInjectedWallet ? (
              <button
                onClick={handleConnectInjected}
                disabled={isConnecting}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-center justify-between text-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-navy-950 block">Browser Extension (MetaMask)</span>
                    <span className="text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Injected Provider Detected
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-azure-700">
                  {isConnected && !isDevAccount ? 'Connected' : 'Connect →'}
                </span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-slate-400" /> MetaMask Extension Not Detected
                  </span>
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-azure-700 hover:text-navy-950 flex items-center gap-1 font-bold"
                  >
                    Install MetaMask <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  No Web3 extension was detected in this browser. You can use the <strong className="text-navy-950">1-Click Local Accounts</strong> above to issue, sign, and verify credentials instantly.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Disconnect if connected */}
        {isConnected && (
          <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => {
                disconnect();
                showToast('info', 'Disconnected', 'Wallet disconnected.');
                onClose();
              }}
              className="text-xs text-rose-700 hover:text-rose-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
            >
              Disconnect Current Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
