/**
 * @file store.ts
 * @summary Lightweight IndexedDB wrapper for persisting custom certificate templates,
 * cached CIDs, and auto-saving drafts.
 */

import { TemplateSpec, TemplateStorageItem } from './types';
import { validateTemplateSpec } from './schema';

const DB_NAME = 'certichain_templates_db';
const DB_VERSION = 1;
const STORE_TEMPLATES = 'templates';
const STORE_DRAFTS = 'drafts';
const STORE_CACHE = 'cid_cache';

interface CidCacheEntry {
  sha256: string;
  cid: string;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'sha256' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Saves or updates a template in IndexedDB.
 */
export async function saveTemplate(spec: TemplateSpec, thumbnailDataUrl?: string): Promise<TemplateStorageItem> {
  const validation = validateTemplateSpec(spec);
  if (!validation.valid) {
    throw new Error(`Invalid template specification: ${validation.errors.join(', ')}`);
  }

  const now = new Date().toISOString();
  const item: TemplateStorageItem = {
    id: spec.id,
    name: spec.name,
    createdAt: spec.createdAt || now,
    updatedAt: now,
    thumbnailDataUrl: thumbnailDataUrl || spec.background.dataUrl,
    spec,
  };

  try {
    const db = await openDB();
    return await new Promise<TemplateStorageItem>((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, 'readwrite');
      const store = tx.objectStore(STORE_TEMPLATES);
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => {
        if (req.error && req.error.name === 'QuotaExceededError') {
          reject(new Error('Browser storage quota exceeded. Please export and delete older templates.'));
        } else {
          reject(req.error || new Error('Failed to save template'));
        }
      };
    });
  } catch (err) {
    console.error('saveTemplate error:', err);
    throw err;
  }
}

/**
 * Lists all saved templates sorted by updatedAt descending.
 */
export async function listTemplates(): Promise<TemplateStorageItem[]> {
  try {
    const db = await openDB();
    return await new Promise<TemplateStorageItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, 'readonly');
      const store = tx.objectStore(STORE_TEMPLATES);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as TemplateStorageItem[]) || [];
        items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(items);
      };
      req.onerror = () => reject(req.error || new Error('Failed to list templates'));
    });
  } catch (err) {
    console.warn('listTemplates fallback:', err);
    return [];
  }
}

/**
 * Gets a specific template by ID or searches by name/spec ID.
 */
export async function getTemplate(id: string): Promise<TemplateStorageItem | null> {
  try {
    const db = await openDB();
    const item = await new Promise<TemplateStorageItem | null>((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, 'readonly');
      const store = tx.objectStore(STORE_TEMPLATES);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Failed to get template'));
    });

    if (item) return item;

    // Fallback: search across all stored templates
    const all = await listTemplates();
    const match = all.find((t) => t.id === id || t.spec.id === id || t.name === id);
    return match || null;
  } catch (err) {
    console.warn('getTemplate error:', err);
    return null;
  }
}

/**
 * Retrieves a template spec by CID or SHA-256 or ID.
 */
export async function getTemplateByCidOrSha256(identifier: string): Promise<TemplateSpec | null> {
  const item = await getTemplate(identifier);
  if (item && item.spec) return item.spec;

  const all = await listTemplates();
  for (const t of all) {
    if (t.id === identifier || t.spec.id === identifier || t.name === identifier) {
      return t.spec;
    }
  }
  return null;
}

/**
 * Clears all stored templates, drafts, and CID cache (Clean State).
 */
export async function clearAllTemplates(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_TEMPLATES, STORE_DRAFTS, STORE_CACHE], 'readwrite');
    tx.objectStore(STORE_TEMPLATES).clear();
    tx.objectStore(STORE_DRAFTS).clear();
    tx.objectStore(STORE_CACHE).clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch (err) {
    console.warn('clearAllTemplates error:', err);
  }
}

/**
 * Deletes a template by ID.
 */
export async function deleteTemplate(id: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_TEMPLATES, 'readwrite');
    const store = tx.objectStore(STORE_TEMPLATES);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to delete template'));
  });
}

/**
 * Autosaves the current editing draft.
 */
export async function saveDraft(spec: TemplateSpec): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFTS, 'readwrite');
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.put({ id: 'active_draft', spec, updatedAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-critical, ignore silent draft autosave failures
  }
}

/**
 * Retrieves the autosaved draft if present.
 */
export async function getDraft(): Promise<TemplateSpec | null> {
  try {
    const db = await openDB();
    return await new Promise<TemplateSpec | null>((resolve) => {
      const tx = db.transaction(STORE_DRAFTS, 'readonly');
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.get('active_draft');
      req.onsuccess = () => resolve(req.result ? req.result.spec : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Clears the active draft.
 */
export async function clearDraft(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    tx.objectStore(STORE_DRAFTS).delete('active_draft');
  } catch {
    // Ignore
  }
}

/**
 * Retrieves cached IPFS CID by template SHA-256 hash.
 */
export async function getCachedCid(sha256: string): Promise<string | null> {
  try {
    const db = await openDB();
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_CACHE, 'readonly');
      const store = tx.objectStore(STORE_CACHE);
      const req = store.get(sha256);
      req.onsuccess = () => resolve(req.result ? req.result.cid : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Saves IPFS CID to cache by template SHA-256 hash.
 */
export async function setCachedCid(sha256: string, cid: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    const entry: CidCacheEntry = { sha256, cid, timestamp: Date.now() };
    tx.objectStore(STORE_CACHE).put(entry);
  } catch {
    // Ignore
  }
}

/**
 * Exports a template spec as a downloadable `.certichain-template.json` file.
 */
export function exportTemplateToFile(spec: TemplateSpec): void {
  const jsonStr = JSON.stringify(spec, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = spec.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'template';
  a.download = `${safeName}.certichain-template.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Imports and validates a template spec from a JSON File.
 */
export async function importTemplateFromFile(file: File): Promise<TemplateSpec> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File does not contain valid JSON syntax.');
  }

  const validation = validateTemplateSpec(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid template file: ${validation.errors.join('; ')}`);
  }

  // Generate a fresh unique ID for the imported template to prevent collision
  const importedSpec = parsed as TemplateSpec;
  importedSpec.id = 'tpl_' + Math.random().toString(36).substring(2, 9);
  importedSpec.createdAt = new Date().toISOString();

  await saveTemplate(importedSpec);
  return importedSpec;
}
