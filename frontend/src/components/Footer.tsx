import React from 'react';
import { CONFIG } from '../config';
import {
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Github,
  Twitter,
  Linkedin,
  Layers,
  HardDrive,
} from 'lucide-react';

interface FooterProps {
  onSelectTab: (tab: 'home' | 'issue' | 'recipient' | 'verify') => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  const explorerUrl = `https://sepolia.etherscan.io/address/${CONFIG.registryAddress}`;

  return (
    <footer className="bg-navy-950 text-slate-300 border-t border-navy-800/80 pt-16 sm:pt-20 pb-10 text-sm">
      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-20">
        {/* 5-Column Expansive Grid with Generous Spacing */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 sm:gap-12 lg:gap-10 xl:gap-14 pb-14 border-b border-navy-800/60">
          {/* Column 1: Rashtriya Raksha University (Enlarged) */}
          <div className="lg:col-span-3 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center flex-shrink-0 drop-shadow-lg">
                <img
                  src="/rru-logo.png"
                  alt="Rashtriya Raksha University"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug block">
                  Rashtriya Raksha University
                </span>
                <p className="text-xs text-gold-400 font-semibold mt-0.5">National Security is Supreme</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 pt-1 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <MapPin size={17} className="text-gold-400 flex-shrink-0 mt-0.5" />
                <span>Lavad, Dehgam, Gandhinagar Gujarat, India, 382305</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone size={17} className="text-gold-400 flex-shrink-0" />
                <span>Tele: +91-079-68126800</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail size={17} className="text-gold-400 flex-shrink-0 mt-0.5" />
                <span>registrar@rru.ac.in (For Administration)</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail size={17} className="text-gold-400 flex-shrink-0 mt-0.5" />
                <span>admission@rru.ac.in (For Admissions Only)</span>
              </div>
            </div>
          </div>

          {/* Column 2: CertiChain Protocol (Enlarged) */}
          <div className="lg:col-span-3 space-y-5">
            <div className="flex items-center gap-3">
              {/* SASET Logo (First) */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center drop-shadow-md flex-shrink-0">
                <img
                  src="/saset-logo.png"
                  alt="SASET Logo"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              {/* CertiChain Logo (Second) */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center drop-shadow-md flex-shrink-0">
                <img
                  src="/certichain-logo.png"
                  alt="CertiChain Emblem"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <span className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug block">
                  CertiChain Ledger
                </span>
                <p className="text-xs text-azure-300 font-semibold mt-0.5">SASET • Web3 Protocol</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Decentralized academic & professional credential verification anchored to Ethereum smart contracts with IPFS distributed storage.
            </p>

            <div className="space-y-2 text-xs sm:text-sm text-slate-300 pt-1">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-azure-400 flex-shrink-0" />
                <span className="font-medium">certichain@rru.ac.in</span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                ERC-Registry • RFC 8785 Canonicalizer
              </p>
            </div>
          </div>

          {/* Column 3: Quick Links (Enlarged) */}
          <div className="lg:col-span-2">
            <h3 className="text-white font-bold text-base sm:text-lg mb-5 tracking-wide relative pb-2 inline-block">
              Quick Links
              <span className="absolute bottom-0 left-0 w-10 h-0.5 bg-gold-400 rounded-full" />
            </h3>
            <ul className="space-y-3 text-xs sm:text-sm">
              <li>
                <button
                  onClick={() => onSelectTab('home')}
                  className="hover:text-white hover:underline transition-colors focus:outline-none"
                >
                  Home Overview
                </button>
              </li>
              <li>
                <a href="#about" onClick={() => onSelectTab('home')} className="hover:text-white hover:underline transition-colors">
                  About the Protocol
                </a>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('issue')}
                  className="hover:text-white hover:underline transition-colors focus:outline-none"
                >
                  Issue Credentials
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('recipient')}
                  className="hover:text-white hover:underline transition-colors focus:outline-none"
                >
                  My Certificates
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('verify')}
                  className="hover:text-white hover:underline transition-colors focus:outline-none"
                >
                  Public Verification
                </button>
              </li>
              <li>
                <a href="#how-it-works" onClick={() => onSelectTab('home')} className="hover:text-white hover:underline transition-colors">
                  How It Works
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Resources & Audit (Enlarged) */}
          <div className="lg:col-span-2">
            <h3 className="text-white font-bold text-base sm:text-lg mb-5 tracking-wide relative pb-2 inline-block">
              Resources & Audit
              <span className="absolute bottom-0 left-0 w-10 h-0.5 bg-gold-400 rounded-full" />
            </h3>
            <ul className="space-y-3 text-xs sm:text-sm">
              <li>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <span>Smart Contract (Sepolia)</span>
                  <ExternalLink size={13} className="text-slate-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <span>GitHub Repository</span>
                  <ExternalLink size={13} className="text-slate-400" />
                </a>
              </li>
              <li>
                <span className="text-slate-400 cursor-default">Frequently Asked Questions</span>
              </li>
              <li>
                <span className="text-slate-400 cursor-default">Technical Support & SLA</span>
              </li>
              <li>
                <span className="text-slate-400 cursor-default">Security Audit: OpenZeppelin v5</span>
              </li>
            </ul>
          </div>

          {/* Column 5: Infrastructure (Enlarged) */}
          <div className="lg:col-span-2">
            <h3 className="text-white font-bold text-base sm:text-lg mb-5 tracking-wide relative pb-2 inline-block">
              Infrastructure
              <span className="absolute bottom-0 left-0 w-10 h-0.5 bg-gold-400 rounded-full" />
            </h3>

            <div className="space-y-4">
              {/* Badge Tile 1 */}
              <div className="bg-white text-navy-950 p-3.5 sm:p-4 rounded-2xl shadow-lg border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center text-navy-900 flex-shrink-0">
                  <Layers size={22} className="text-azure-600" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block truncate">Blockchain</span>
                  <span className="text-sm font-extrabold text-navy-950 truncate block">Ethereum Sepolia</span>
                </div>
              </div>

              {/* Badge Tile 2 */}
              <div className="bg-white text-navy-950 p-3.5 sm:p-4 rounded-2xl shadow-lg border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center text-navy-900 flex-shrink-0">
                  <HardDrive size={22} className="text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block truncate">Storage Layer</span>
                  <span className="text-sm font-extrabold text-navy-950 truncate block">IPFS & Pinata</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Utility & Social Row */}
        <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 border-b border-navy-800/40">
          <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-start">
            <a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <span>|</span>
            <a href="#terms" className="hover:text-white transition-colors">Terms of Use</a>
            <span>|</span>
            <a href="#disclaimer" className="hover:text-white transition-colors">Disclaimer</a>
            <span>|</span>
            <a href="#accessibility" className="hover:text-white transition-colors">Accessibility</a>
            <span>|</span>
            <a href="#sitemap" className="hover:text-white transition-colors">Sitemap</a>
            <span>|</span>
            <a href="#help" className="hover:text-white transition-colors">Help</a>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="GitHub">
              <Github size={16} />
            </a>
            <a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="Twitter">
              <Twitter size={16} />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="LinkedIn">
              <Linkedin size={16} />
            </a>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>Last Updated: October 2026</span>
            <span>•</span>
            <span className="text-emerald-400">Network: Live (Sepolia)</span>
          </div>
        </div>

        {/* Bottom copyright notice */}
        <div className="pt-6 text-center text-xs text-slate-400 space-y-1">
          <p>© 2026 Rashtriya Raksha University & CertiChain Ledger. All rights reserved.</p>
          <p className="text-[11px] text-slate-400">
            Content owned & provided by Rashtriya Raksha University (SASET), India • Solidity 0.8.24 • RFC 8785
          </p>
        </div>
      </div>
    </footer>
  );
};
