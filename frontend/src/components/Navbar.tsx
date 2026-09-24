import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { CONFIG } from '../config';
import { WalletModal } from './WalletModal';
import { ShieldCheck, Wallet, Check, Copy, LogOut, ChevronDown, Sparkles } from 'lucide-react';

interface NavbarProps {
  activeTab: 'issue' | 'recipient' | 'verify';
  onSelectTab: (tab: 'issue' | 'recipient' | 'verify') => void;
  isIssuer?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, isIssuer }) => {
  const { account, isConnected, isConnecting, disconnect, isCorrectNetwork, isDevAccount } = useWallet();
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (account) {
      navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncatedAccount = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : '';

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => onSelectTab('verify')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-teal-300 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                CertiChain
              </span>
              <span className="hidden sm:inline-block ml-1.5 text-xs font-mono uppercase tracking-widest text-teal-500/80">
                Ledger
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onSelectTab('issue')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'issue'
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Issue Credential {isIssuer && <span className="ml-1 text-[10px] text-teal-400 font-semibold">• Issuer</span>}
            </button>
            <button
              onClick={() => onSelectTab('recipient')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'recipient'
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              My Credentials
            </button>
            <button
              onClick={() => onSelectTab('verify')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'verify'
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Verify Portal
            </button>
          </nav>
        </div>

        {/* Right Actions / Wallet */}
        <div className="flex items-center gap-3">
          {/* Network Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected
                  ? isCorrectNetwork
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : 'bg-amber-400'
                  : 'bg-slate-600'
              }`}
            />
            <span>{CONFIG.targetChainName}</span>
          </div>

          {/* Connect Button or Account Menu */}
          {!isConnected ? (
            <button
              onClick={() => setWalletModalOpen(true)}
              disabled={isConnecting}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-xs font-semibold"
            >
              <Wallet className="w-4 h-4" />
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-200 transition-all shadow-sm"
              >
                <div className={`w-2 h-2 rounded-full ${isDevAccount ? 'bg-amber-400' : 'bg-teal-400'}`} />
                <span>{truncatedAccount}</span>
                {isDevAccount && (
                  <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-sans">
                    Dev Mode
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-60 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onMouseLeave={() => setDropdownOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-slate-800/60 mb-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Connected Address</p>
                      {isDevAccount && (
                        <span className="text-[9px] text-amber-300 bg-amber-400/10 px-1 rounded">Dev Local</span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-200 truncate mt-0.5">{account}</p>
                  </div>

                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      {copied ? 'Copied to clipboard' : 'Copy address'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setWalletModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-teal-300 hover:bg-teal-950/40 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Switch Account / Wallet
                  </button>

                  <button
                    onClick={() => {
                      disconnect();
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Wallet Modal */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />

      {/* Mobile nav bottom bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/60 px-2 py-1.5 bg-slate-950/90 text-xs">
        <button
          onClick={() => onSelectTab('issue')}
          className={`px-3 py-1 rounded-md ${activeTab === 'issue' ? 'text-teal-400 font-semibold' : 'text-slate-400'}`}
        >
          Issue
        </button>
        <button
          onClick={() => onSelectTab('recipient')}
          className={`px-3 py-1 rounded-md ${activeTab === 'recipient' ? 'text-teal-400 font-semibold' : 'text-slate-400'}`}
        >
          Credentials
        </button>
        <button
          onClick={() => onSelectTab('verify')}
          className={`px-3 py-1 rounded-md ${activeTab === 'verify' ? 'text-teal-400 font-semibold' : 'text-slate-400'}`}
        >
          Verify
        </button>
      </div>
    </header>
  );
};
