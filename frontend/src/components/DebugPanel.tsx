import React, { useState, useEffect } from 'react';
import { tracer, TraceEntry } from '../lib/debugTrace';
import { Terminal, Copy, Check, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

export const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<TraceEntry[]>([]);
  const [copied, setCopied] = useState(false);

  // Check if debug panel is enabled in dev or with ?debug=1
  const isEnabled = typeof window !== 'undefined' &&
    (import.meta.env.DEV || window.location.search.includes('debug=1'));

  useEffect(() => {
    if (!isEnabled) return;
    const interval = setInterval(() => {
      setEntries(tracer.getEntries());
    }, 500);
    return () => clearInterval(interval);
  }, [isEnabled]);

  if (!isEnabled) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(tracer.exportJson());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-3 left-3 z-[9999] font-mono text-xs select-none">
      {isOpen ? (
        <div className="bg-slate-950 text-slate-100 border border-slate-700 rounded-xl shadow-2xl w-[92vw] sm:w-[480px] max-h-[70vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-azure-400" />
              <span className="font-bold text-azure-400">CERTI-CHAIN TRACE ({entries.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1 text-[11px]"
                title="Copy full trace JSON"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
              <button
                onClick={() => tracer.clear()}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded"
                title="Clear Trace Buffer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 text-slate-400 rounded"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Trace Log Stream */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 text-[11px] leading-snug">
            {entries.length === 0 ? (
              <p className="text-slate-500 py-4 text-center">No trace events recorded yet.</p>
            ) : (
              entries.map((e, idx) => (
                <div key={idx} className="p-1.5 bg-slate-900/80 rounded border border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 border-b border-slate-800 pb-0.5">
                    <span className="font-bold text-emerald-400">{e.stage}</span>
                    <span>{e.timestamp.split('T')[1].slice(0, 8)}</span>
                  </div>
                  <pre className="text-[10px] text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-32">
                    {JSON.stringify(e.data, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-slate-900/90 hover:bg-slate-800 text-azure-400 border border-slate-700 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold backdrop-blur"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Debug Trace ({entries.length})</span>
          <ChevronUp className="w-3 h-3 text-slate-400" />
        </button>
      )}
    </div>
  );
};
