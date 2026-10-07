import React, { useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';

export const AnnouncementStrip: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <aside aria-label="Prototype announcement" className="bg-white border-b border-slate-200/90 py-2.5 px-4 shadow-subtle relative z-20">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs sm:text-sm font-medium text-slate-800">
        <div className="flex items-center gap-2 mx-auto text-center">
          <ShieldAlert size={16} className="text-amber-600 flex-shrink-0" />
          <p>
            <span className="font-bold text-navy-950">Notice:</span>{' '}
            CertiChain prototype is live on Sepolia testnet. Certificates issued here have no real-world validity.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors focus:outline-none"
          aria-label="Dismiss banner"
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
};
