/**
 * Dynamic Form Generator Component (Step 3: Fill & Preview)
 * Automatically builds an accessible, validated form matching the template's detected field schema.
 */

import React from 'react';
import type { CertificateTemplate } from '../../types/customTemplate';
import { FileText, Wallet } from 'lucide-react';

interface DynamicFormProps {
  template: CertificateTemplate;
  values: Record<string, string>;
  onValueChange: (key: string, value: string) => void;
  recipientWalletAddress: string;
  onRecipientWalletChange: (addr: string) => void;
  onFocusField?: (key: string | null) => void;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  template,
  values,
  onValueChange,
  recipientWalletAddress,
  onRecipientWalletChange,
  onFocusField,
}) => {
  const renderedFields = template.fields.filter(
    (f) => !['qrCode', 'certId', 'proofHash'].includes(f.type)
  );

  return (
    <div className="space-y-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-navy-950 dark:text-white font-bold text-sm">
          <FileText className="w-4 h-4 text-azure-600" />
          <span>Credential Details ({template.fields.length} fields)</span>
        </div>
        <span className="text-xs text-slate-400 font-mono">{template.orientation} layout</span>
      </div>

      <div className="space-y-4">
        {/* On-Chain Recipient Wallet (Always Required) */}
        <div>
          <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
            Recipient Wallet Address (On-Chain) *
          </label>
          <div className="relative">
            <input
              type="text"
              value={recipientWalletAddress}
              onChange={(e) => onRecipientWalletChange(e.target.value)}
              placeholder="0x7099... or 0x0000..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-azure-500"
            />
            <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Required on-chain recipient identifier. Set to 0x0 for anonymous holder delivery.
          </p>
        </div>

        {/* Dynamic Fields List */}
        {renderedFields.map((field) => {
          const val = values[field.key] ?? field.sampleText ?? '';

          return (
            <div
              key={field.key}
              onFocus={() => onFocusField?.(field.key)}
              onBlur={() => onFocusField?.(null)}
              className="space-y-1"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-navy-950 dark:text-slate-200">
                  {field.label} {field.required && <span className="text-rose-500">*</span>}
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  {field.box ? 'Rendered' : 'Metadata only'}
                </span>
              </div>

              {field.type === 'compositeText' && field.tokens && field.tokens.length > 0 ? (
                <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    Template: &ldquo;{field.compositeTemplate}&rdquo;
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {field.tokens.map((token) => {
                      const tokenVal = values[token.key] ?? token.sampleValue ?? '';
                      return (
                        <div key={token.key} className="space-y-0.5">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {token.label}
                          </label>
                          <input
                            type={token.type === 'date' ? 'date' : token.type === 'number' ? 'number' : 'text'}
                            value={tokenVal}
                            onChange={(e) => onValueChange(token.key, e.target.value)}
                            placeholder={token.sampleValue || `Enter ${token.label.toLowerCase()}...`}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-azure-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : field.type === 'longText' ? (
                <textarea
                  rows={2}
                  value={val}
                  onChange={(e) => onValueChange(field.key, e.target.value)}
                  placeholder={field.sampleText || `Enter ${field.label.toLowerCase()}...`}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-azure-500 resize-none"
                />
              ) : field.type === 'date' ? (
                <input
                  type="date"
                  value={val}
                  onChange={(e) => onValueChange(field.key, e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-azure-500"
                />
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  value={val}
                  onChange={(e) => onValueChange(field.key, e.target.value)}
                  placeholder={field.sampleText || '0'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-azure-500"
                />
              ) : field.type === 'select' && field.options && field.options.length > 0 ? (
                <select
                  value={val}
                  onChange={(e) => onValueChange(field.key, e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-azure-500"
                >
                  <option value="">Select option...</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'email' ? 'email' : 'text'}
                  value={val}
                  onChange={(e) => onValueChange(field.key, e.target.value)}
                  placeholder={field.sampleText || `Enter ${field.label.toLowerCase()}...`}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-azure-500"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
