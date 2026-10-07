import React from 'react';
import { TemplateSpec } from '../../lib/template/types';
import { Sparkles, Shield } from 'lucide-react';

interface DynamicFieldsProps {
  spec: TemplateSpec;
  values: Record<string, string>;
  recipientAddress: string;
  recipientEmail: string;
  expiryDate: string;
  listingTitle: string;
  focusedFieldKey: string | null;
  onValueChange: (key: string, val: string) => void;
  onRecipientAddressChange: (val: string) => void;
  onRecipientEmailChange: (val: string) => void;
  onExpiryDateChange: (val: string) => void;
  onListingTitleChange: (val: string) => void;
  onFocusField: (key: string | null) => void;
}

export const DynamicFields: React.FC<DynamicFieldsProps> = ({
  spec,
  values,
  recipientAddress,
  recipientEmail,
  expiryDate,
  listingTitle,
  focusedFieldKey,
  onValueChange,
  onRecipientAddressChange,
  onRecipientEmailChange,
  onExpiryDateChange,
  onListingTitleChange,
  onFocusField,
}) => {
  return (
    <div className="space-y-6">
      {/* Section 1: Certificate Content (Generated from Template Fields) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <Sparkles className="w-4 h-4 text-azure-600 dark:text-azure-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Certificate Content ({spec.fields.length} Fields)
          </h3>
        </div>

        <div className="space-y-4">
          {spec.fields.map((field) => {
            const currentVal = values[field.key] ?? '';
            const isFocused = focusedFieldKey === field.key;

            return (
              <div
                key={field.key}
                className={`transition-all rounded-xl p-2.5 -m-2.5 ${
                  isFocused ? 'bg-azure-50/50 dark:bg-azure-950/20' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-navy-950 dark:text-slate-200 flex items-center gap-1.5">
                    <span>{field.label}</span>
                    {field.required && <span className="text-rose-500 font-bold">*</span>}
                    {field.mapsTo && field.mapsTo !== 'custom' && (
                      <span className="text-[10px] text-slate-400 font-normal font-mono">
                        ({field.mapsTo.replace('_', ' ')})
                      </span>
                    )}
                  </label>

                  {field.maxLength && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {currentVal.length}/{field.maxLength}
                    </span>
                  )}
                </div>

                {field.type === 'textarea' ? (
                  <textarea
                    rows={2}
                    value={currentVal}
                    onChange={(e) => onValueChange(field.key, e.target.value)}
                    onFocus={() => onFocusField(field.key)}
                    onBlur={() => onFocusField(null)}
                    maxLength={field.maxLength}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-azure-500 focus:outline-none transition-all shadow-sm resize-none leading-relaxed"
                    placeholder={`e.g. ${field.sample}`}
                  />
                ) : field.type === 'select' && field.options && field.options.length > 0 ? (
                  <select
                    value={currentVal || field.sample}
                    onChange={(e) => onValueChange(field.key, e.target.value)}
                    onFocus={() => onFocusField(field.key)}
                    onBlur={() => onFocusField(null)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-azure-500 focus:outline-none transition-all shadow-sm"
                  >
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'date' ? (
                  <input
                    type="date"
                    value={currentVal}
                    onChange={(e) => onValueChange(field.key, e.target.value)}
                    onFocus={() => onFocusField(field.key)}
                    onBlur={() => onFocusField(null)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-azure-500 focus:outline-none transition-all shadow-sm"
                  />
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={currentVal}
                    onChange={(e) => onValueChange(field.key, e.target.value)}
                    onFocus={() => onFocusField(field.key)}
                    onBlur={() => onFocusField(null)}
                    maxLength={field.maxLength}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-azure-500 focus:outline-none transition-all shadow-sm"
                    placeholder={`e.g. ${field.sample}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Blockchain Details (Standard on-chain identity & records) */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Blockchain & Registry Details
          </h3>
        </div>

        <div className="space-y-4">
          {/* Recipient Wallet Address */}
          <div>
            <label className="block text-xs font-semibold text-navy-950 dark:text-slate-200 mb-1.5">
              Recipient Wallet Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => onRecipientAddressChange(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-azure-500 focus:outline-none transition-all shadow-sm"
              placeholder="0x..."
            />
          </div>

          {/* Recipient Email / ID */}
          <div>
            <label className="block text-xs font-semibold text-navy-950 dark:text-slate-200 mb-1.5">
              Recipient Email / Student ID <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={recipientEmail}
              onChange={(e) => onRecipientEmailChange(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-azure-500 focus:outline-none transition-all shadow-sm"
              placeholder="e.g. recipient@university.edu"
            />
          </div>

          {/* Listing Title */}
          <div>
            <label className="block text-xs font-semibold text-navy-950 dark:text-slate-200 mb-1.5">
              Registry Listing Title
            </label>
            <input
              type="text"
              value={listingTitle}
              onChange={(e) => onListingTitleChange(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-azure-500 focus:outline-none transition-all shadow-sm"
              placeholder="Title shown on recipient dashboard"
            />
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-xs font-semibold text-navy-950 dark:text-slate-200 mb-1.5">
              Expiry Date <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => onExpiryDateChange(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-azure-500 focus:outline-none transition-all shadow-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
