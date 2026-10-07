/**
 * Standard Institutional Issuance Form Component
 * Encapsulates the baseline institutional certificate input form, preserving original issuance flow.
 */

import React from 'react';
import type { IssuanceFormData } from '../types/certificate';
import { FileText, Plus, Trash2 } from 'lucide-react';

interface StandardIssueFormProps {
  formData: IssuanceFormData;
  onChangeField: (key: keyof IssuanceFormData, value: string) => void;
  onChangeAdditionalField: (index: number, key: string, value: string) => void;
  onAddAdditionalField: () => void;
  onRemoveAdditionalField: (index: number) => void;
}

export const StandardIssueForm: React.FC<StandardIssueFormProps> = ({
  formData,
  onChangeField,
  onChangeAdditionalField,
  onAddAdditionalField,
  onRemoveAdditionalField,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-navy-950 dark:text-white font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-3">
        <FileText className="w-4 h-4 text-azure-700" />
        <span>Institutional Credential Specification</span>
      </div>

      <div>
        <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
          Certificate Title *
        </label>
        <input
          type="text"
          value={formData.certificateTitle}
          onChange={(e) => onChangeField('certificateTitle', e.target.value)}
          placeholder="e.g. Master in Blockchain Architecture"
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-navy-900 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
          Recipient Full Name *
        </label>
        <input
          type="text"
          value={formData.recipientName}
          onChange={(e) => onChangeField('recipientName', e.target.value)}
          placeholder="e.g. Alice Nakamoto"
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-navy-900 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
            Recipient Wallet Address
          </label>
          <input
            type="text"
            value={formData.recipientAddress}
            onChange={(e) => onChangeField('recipientAddress', e.target.value)}
            placeholder="0x... (or leave 0x0)"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-navy-900 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
            Recipient Email / ID
          </label>
          <input
            type="text"
            value={formData.recipientIdentifier}
            onChange={(e) => onChangeField('recipientIdentifier', e.target.value)}
            placeholder="alice@domain.org"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-navy-900 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
          Issuer Organization Name *
        </label>
        <input
          type="text"
          value={formData.issuerName}
          onChange={(e) => onChangeField('issuerName', e.target.value)}
          placeholder="e.g. Decentralized Academic Consortium"
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-navy-900 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
          Credential Description
        </label>
        <textarea
          rows={2}
          value={formData.description}
          onChange={(e) => onChangeField('description', e.target.value)}
          placeholder="Describe the skills and achievement accredited..."
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-navy-900 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
            Date of Issue *
          </label>
          <input
            type="date"
            value={formData.issueDate}
            onChange={(e) => onChangeField('issueDate', e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-navy-900 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-900/20"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-navy-950 dark:text-slate-200 mb-1">
            Expiry Date (Optional)
          </label>
          <input
            type="date"
            value={formData.expiryDate}
            onChange={(e) => onChangeField('expiryDate', e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-navy-900 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-900/20"
          />
        </div>
      </div>

      {/* Additional Key-Value Fields */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-navy-950 dark:text-slate-200">Additional Fields</label>
          <button
            type="button"
            onClick={onAddAdditionalField}
            className="text-azure-700 dark:text-azure-400 hover:text-navy-950 text-xs font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Field
          </button>
        </div>

        <div className="space-y-2">
          {formData.additionalFields.map((field, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Key (e.g. Grade)"
                value={field.key}
                onChange={(e) => onChangeAdditionalField(idx, e.target.value, field.value)}
                className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-navy-900"
              />
              <input
                type="text"
                placeholder="Value (e.g. Distinction)"
                value={field.value}
                onChange={(e) => onChangeAdditionalField(idx, field.key, e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-navy-900"
              />
              <button
                type="button"
                onClick={() => onRemoveAdditionalField(idx)}
                className="text-slate-400 hover:text-rose-600 transition-colors p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
