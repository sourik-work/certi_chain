import React, { useState } from 'react';
import { HelpCircle, X, ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    question: 'What is CertiChain?',
    answer: 'CertiChain is a decentralized credential protocol that issues and verifies tamper-proof certificates anchored onto Ethereum smart contracts with IPFS distributed metadata storage.',
  },
  {
    question: 'How do I verify a certificate?',
    answer: 'Simply copy the 32-byte Certificate ID (Proof Hash) or scan the certificate QR code on the Verify page. Verification is 100% public, instant, and requires zero wallet connection.',
  },
  {
    question: 'What if a certificate shows "Tampered / Invalid"?',
    answer: 'If any single field in the certificate JSON metadata has been altered after issuance, its client-computed SHA-256 hash will not match the immutable hash recorded on the blockchain ledger, immediately flagging it as tampered.',
  },
  {
    question: 'How does credential revocation work?',
    answer: 'Only authorized issuing authorities or the contract administrator can revoke a certificate on-chain. When revoked, the credential status immediately updates to "Revoked" across all verification scans.',
  },
];

export const FloatingHelp: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const toggleAccordion = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Help Panel Drawer */}
      {isOpen && (
        <div
          className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-floating p-5 text-slate-800 animate-in fade-in slide-in-from-bottom-5 duration-200"
          role="dialog"
          aria-label="FAQ and Support"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-navy-900 text-white flex items-center justify-center">
                <HelpCircle size={16} />
              </div>
              <h3 className="font-bold text-navy-950 text-sm">Protocol Knowledge Base</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100"
              aria-label="Close help panel"
            >
              <X size={16} />
            </button>
          </div>

          {/* FAQ Accordion List */}
          <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {FAQ_DATA.map((item, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-xl overflow-hidden text-xs transition-colors"
                >
                  <button
                    onClick={() => toggleAccordion(idx)}
                    className="w-full px-3 py-2.5 text-left font-semibold text-navy-950 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between gap-2"
                    aria-expanded={isExpanded}
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      size={14}
                      className={`text-slate-500 transition-transform duration-200 flex-shrink-0 ${
                        isExpanded ? 'rotate-180 text-navy-900' : ''
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="px-3 py-2.5 bg-white text-slate-600 leading-relaxed border-t border-slate-100">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Need institutional onboarding?</span>
            <a
              href="mailto:contact@certichain.example.org"
              className="text-azure-700 font-bold hover:underline"
            >
              Contact Team
            </a>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-navy-900 text-white shadow-floating hover:bg-navy-800 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-navy-900/20"
        aria-label={isOpen ? 'Close help drawer' : 'Open protocol help drawer'}
      >
        {isOpen ? <X size={24} /> : <HelpCircle size={26} />}
      </button>
    </div>
  );
};
