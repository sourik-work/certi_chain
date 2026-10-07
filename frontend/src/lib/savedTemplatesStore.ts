/**
 * Saved Custom Certificate Templates Storage Store
 * Manages persisting, updating, listing, and retrieving saved custom certificate templates
 * with support for localStorage, thumbnail caching, and issue count tracking.
 */

import type { CertificateTemplate } from '../types/customTemplate';
import { resolveCustomCertificateInfo } from './customMetadataHelper';

export interface SavedCustomTemplate {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  issueCount: number;
  template: CertificateTemplate;
  lastValues?: Record<string, string>;
  lastRecipientWallet?: string;
  thumbnailUrl?: string;
}

const STORAGE_KEY = 'certichain_saved_custom_templates';

/**
 * Retrieve all saved custom templates from storage, sorted by most recently updated first.
 */
export function getSavedCustomTemplates(): SavedCustomTemplate[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedCustomTemplate[];
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  } catch (err) {
    console.warn('Failed to parse saved templates from localStorage:', err);
    return [];
  }
}

/**
 * Save or update a custom certificate template in the saved templates library.
 */
export function saveSavedCustomTemplate(
  template: CertificateTemplate,
  customTitle?: string,
  values?: Record<string, string>,
  recipientWallet?: string
): SavedCustomTemplate {
  const existing = getSavedCustomTemplates();
  const id = template.templateHash || `tpl_${Date.now()}`;

  // Resolve a sensible title if not provided
  let title = customTitle?.trim();
  if (!title) {
    if (values) {
      const resolved = resolveCustomCertificateInfo({}, values);
      title = resolved.certificateTitle || 'Custom Certificate Template';
    } else {
      title = 'Custom Certificate Template';
    }
  }

  const existingIndex = existing.findIndex((t) => t.id === id || t.template.templateHash === template.templateHash);
  const now = new Date().toISOString();

  let item: SavedCustomTemplate;

  if (existingIndex >= 0) {
    const prev = existing[existingIndex];
    item = {
      ...prev,
      title: title || prev.title,
      createdAt: prev.createdAt || now,
      updatedAt: now,
      issueCount: prev.issueCount + 1,
      template: {
        ...template,
        previewDataUrl: template.previewDataUrl || prev.template.previewDataUrl,
        cleanedBaseDataUrl: template.cleanedBaseDataUrl || prev.template.cleanedBaseDataUrl,
      },
      lastValues: values || prev.lastValues,
      lastRecipientWallet: recipientWallet || prev.lastRecipientWallet,
      thumbnailUrl: template.previewDataUrl || template.cleanedBaseDataUrl || prev.thumbnailUrl,
    };
    existing[existingIndex] = item;
  } else {
    item = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      issueCount: 1,
      template,
      lastValues: values,
      lastRecipientWallet: recipientWallet,
      thumbnailUrl: template.previewDataUrl || template.cleanedBaseDataUrl,
    };
    existing.unshift(item);
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    // If quota exceeded due to large base64 images, store a compact version
    console.warn('LocalStorage save failed, attempting compact storage:', err);
    try {
      const compactList = existing.map((t) => ({
        ...t,
        template: {
          ...t.template,
          previewDataUrl: t.template.previewDataUrl ? t.template.previewDataUrl.slice(0, 5000) : undefined,
        },
        thumbnailUrl: undefined,
      }));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compactList));
    } catch (compactErr) {
      console.error('Storage quota exceeded completely:', compactErr);
    }
  }

  return item;
}

/**
 * Delete a saved custom template by ID.
 */
export function deleteSavedCustomTemplate(id: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const existing = getSavedCustomTemplates();
  const filtered = existing.filter((t) => t.id !== id && t.template.templateHash !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to update localStorage after delete:', err);
  }
}

/**
 * Rename a saved template.
 */
export function renameSavedCustomTemplate(id: string, newTitle: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const existing = getSavedCustomTemplates();
  const target = existing.find((t) => t.id === id || t.template.templateHash === id);
  if (target) {
    target.title = newTitle.trim() || target.title;
    target.updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (err) {
      console.error('Failed to update localStorage after rename:', err);
    }
  }
}
