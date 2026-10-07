import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../hooks/useWallet';
import { CONFIG } from '../config';
import { WalletModal } from './WalletModal';
import {
  ChevronDown,
  Menu,
  X,
  ExternalLink,
  Github,
  Twitter,
  Linkedin,
  HelpCircle,
  FileCode2,
  Radio,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'home' | 'issue' | 'recipient' | 'verify';
  onSelectTab: (tab: 'home' | 'issue' | 'recipient' | 'verify') => void;
  isIssuer: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  isIssuer,
}) => {
  const { account, isConnected, chainId } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resourcesDropdownOpen, setResourcesDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Shrink/collapse Tier A after scrolling 80px
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setResourcesDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setResourcesDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const explorerUrl = chainId === 11155111 || CONFIG.targetChainId === 11155111
    ? `https://sepolia.etherscan.io/address/${CONFIG.registryAddress}`
    : '#';

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const navItems = [
    { id: 'home', label: 'Home', isAction: true },
    { id: 'about', label: 'About', href: '#about' },
    { id: 'issue', label: 'Issue', isAction: true, badge: isIssuer ? 'Authorized' : undefined },
    { id: 'recipient', label: 'My Certificates', isAction: true },
    { id: 'verify', label: 'Verify', isAction: true },
    { id: 'how-it-works', label: 'How It Works', href: '#how-it-works' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-navy-900 text-white shadow-md select-none transition-all duration-300">
      {/* TIER A: Top Utility Bar */}
      <div
        className={`bg-navy-950/90 border-b border-navy-800/80 text-[11px] sm:text-xs text-slate-300 transition-all duration-300 overflow-hidden ${
          scrolled ? 'max-h-0 py-0 opacity-0' : 'max-h-12 py-1.5 opacity-100'
        }`}
      >
        <div className="w-full px-3 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Social Links */}
          <div className="flex items-center gap-3 text-slate-400">
            <span className="hidden sm:inline font-medium text-slate-400">Connect:</span>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="GitHub">
              <Github size={13} />
            </a>
            <a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="Twitter">
              <Twitter size={13} />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="LinkedIn">
              <Linkedin size={13} />
            </a>
          </div>

          {/* Utility text links */}
          <div className="flex items-center gap-3 sm:gap-4 font-medium">
            <a href={explorerUrl} target="_blank" rel="noreferrer" className="hover:text-gold-300 flex items-center gap-1 transition-colors">
              <span>Smart Contract</span>
              <ExternalLink size={10} />
            </a>
            <span className="text-navy-700 hidden sm:inline">|</span>
            <a href="https://sepoliafaucet.com" target="_blank" rel="noreferrer" className="hover:text-gold-300 hidden sm:inline transition-colors">
              Testnet Faucet
            </a>
            <span className="text-navy-700 hidden sm:inline">|</span>
            <a href="#faq" onClick={() => onSelectTab('home')} className="hover:text-gold-300 transition-colors">
              FAQ
            </a>
            <span className="text-navy-700 hidden sm:inline">|</span>
            <a href="#contact" onClick={() => onSelectTab('home')} className="hover:text-gold-300 hidden sm:inline transition-colors">
              Support
            </a>
          </div>
        </div>
      </div>

      {/* TIER B: Brand & Connection Row */}
      <div className="border-b border-navy-800/80 bg-navy-900 py-2 sm:py-2.5">
        <div className="w-full px-2 sm:px-4 lg:px-6 flex items-center justify-between">
          {/* Brand Logos (RRU Crest + CertiChain Emblem) & Name */}
          <button
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-3 sm:gap-4 lg:gap-5 text-left group focus:outline-none focus:ring-2 focus:ring-azure-400 rounded-xl p-0.5"
          >
            {/* Rashtriya Raksha University (RRU) Crest (Proportionate & Transparent) */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-[5.5rem] lg:h-[5.5rem] flex items-center justify-center group-hover:scale-105 transition-all flex-shrink-0 drop-shadow-lg">
              <img
                src="/rru-logo.png"
                alt="Rashtriya Raksha University Crest"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Subtle Vertical Divider */}
            <div className="h-10 sm:h-12 lg:h-14 w-px bg-navy-700/80 mx-0.5 sm:mx-1 hidden xs:block" />

            {/* Official CertiChain Emblem + Text Group */}
            <div className="flex items-center gap-3 sm:gap-3.5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-[5.25rem] lg:h-[5.25rem] rounded-full overflow-hidden flex items-center justify-center drop-shadow-lg group-hover:scale-105 transition-all flex-shrink-0">
                <img
                  src="/certichain-logo.png"
                  alt="CertiChain Emblem"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-sans">
                    CertiChain
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-gold-500/20 text-gold-300 border border-gold-500/40 px-2 py-0.5 rounded">
                    Ledger
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-300 font-medium tracking-normal hidden xs:block">
                  SASET • Rashtriya Raksha University
                </p>
              </div>
            </div>
          </button>

          {/* Right: Network Indicator, Wallet Connect Pill & SASET Logo */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            {/* Network pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-navy-950/80 border border-navy-700/80 text-xs font-semibold text-slate-200">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{chainId === 11155111 ? 'Sepolia Testnet' : chainId === 31337 ? 'Hardhat Localhost' : CONFIG.targetChainName}</span>
            </div>

            {/* Wallet Button */}
            {isConnected && account ? (
              <button
                onClick={() => setWalletModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white text-navy-950 hover:bg-slate-100 font-semibold text-xs sm:text-sm border border-slate-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-azure-400"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-mono">{truncateAddress(account)}</span>
                {isIssuer && (
                  <span className="hidden md:inline-block bg-navy-900 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                    Issuer
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={() => setWalletModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full bg-white text-navy-900 hover:bg-slate-100 font-bold text-xs sm:text-sm border border-slate-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-azure-400"
              >
                <span>Connect Wallet</span>
              </button>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-200 hover:bg-navy-800 transition-colors focus:outline-none focus:ring-2 focus:ring-azure-400"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Subtle Divider before SASET Logo */}
            <div className="h-10 sm:h-12 lg:h-14 w-px bg-navy-700/80 mx-0.5 hidden xs:block" />

            {/* SASET School of Applied Sciences Logo (Round Shape, Matching CertiChain Logo Size) */}
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 lg:w-[5.25rem] lg:h-[5.25rem] rounded-full overflow-hidden flex items-center justify-center drop-shadow-lg hover:scale-105 transition-all flex-shrink-0"
              title="School of Applied Sciences, Engineering and Technology (SASET) • Rashtriya Raksha University"
            >
              <img
                src="/saset-logo.png"
                alt="School of Applied Sciences, Engineering and Technology (SASET) Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TIER C: Main Navigation Bar */}
      <div className="hidden lg:block bg-navy-950 border-b border-navy-800/80">
        <div className="w-full px-2 sm:px-4 lg:px-6">
          <nav className="flex items-center justify-between text-xs sm:text-sm font-semibold tracking-wide">
            <div className="flex items-center space-x-1 pl-2 sm:pl-4 lg:pl-6">
              {navItems.map((item) => {
                const isActive = item.isAction && activeTab === item.id;
                return item.isAction ? (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id as any)}
                    className={`relative px-4 py-3 rounded-none transition-colors duration-150 flex items-center gap-1.5 focus:outline-none ${
                      isActive
                        ? 'text-white font-bold bg-navy-900 border-b-2 border-gold-400'
                        : 'text-slate-300 hover:text-white hover:bg-navy-900/60'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ) : (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={() => onSelectTab('home')}
                    className="px-4 py-3 text-slate-300 hover:text-white hover:bg-navy-900/60 transition-colors duration-150"
                  >
                    {item.label}
                  </a>
                );
              })}

              {/* Resources Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setResourcesDropdownOpen(!resourcesDropdownOpen)}
                  aria-expanded={resourcesDropdownOpen}
                  className="px-4 py-3 text-slate-300 hover:text-white hover:bg-navy-900/60 flex items-center gap-1 transition-colors duration-150 focus:outline-none"
                >
                  <span>Resources</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${resourcesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {resourcesDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-56 rounded-xl bg-white text-slate-900 shadow-floating border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 hover:text-navy-900 font-medium transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileCode2 size={16} className="text-azure-600" />
                        <span>Smart Contract</span>
                      </div>
                      <ExternalLink size={12} className="text-slate-400" />
                    </a>
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 hover:text-navy-900 font-medium transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Github size={16} className="text-slate-700" />
                        <span>GitHub Repository</span>
                      </div>
                      <ExternalLink size={12} className="text-slate-400" />
                    </a>
                    <a
                      href="#faq"
                      onClick={() => {
                        setResourcesDropdownOpen(false);
                        onSelectTab('home');
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 hover:text-navy-900 font-medium transition-colors"
                    >
                      <HelpCircle size={16} className="text-gold-600" />
                      <span>Protocol FAQ</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Right Tagline badge */}
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
              <Radio size={12} className="text-emerald-400 animate-pulse" />
              <span>ERC-Registry Protocol</span>
            </div>
          </nav>
        </div>
      </div>

      {/* MOBILE SLIDE-OVER MENU */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-[60px] z-50 bg-navy-950/95 backdrop-blur-md p-6 overflow-y-auto border-t border-navy-800 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.isAction) {
                    onSelectTab(item.id as any);
                  } else if (item.href) {
                    window.location.hash = item.href;
                    onSelectTab('home');
                  }
                  setMobileMenuOpen(false);
                }}
                className={`text-left px-4 py-3 rounded-xl font-bold text-base flex items-center justify-between ${
                  item.isAction && activeTab === item.id
                    ? 'bg-navy-900 text-white border-l-4 border-gold-400'
                    : 'text-slate-300 hover:bg-navy-900/60'
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}

            <div className="pt-4 border-t border-navy-800 flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-4">
                Resources
              </span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 text-sm text-slate-300 hover:text-white flex items-center justify-between"
              >
                <span>Smart Contract on Etherscan</span>
                <ExternalLink size={14} />
              </a>
              <a
                href="https://sepoliafaucet.com"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 text-sm text-slate-300 hover:text-white flex items-center justify-between"
              >
                <span>Sepolia Testnet Faucet</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </header>
  );
};
