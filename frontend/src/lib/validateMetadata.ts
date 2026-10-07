/**
 * @file validateMetadata.ts
 * @summary Single Responsibility: Validates and sanitizes certificate metadata schema before hashing and pinning.
 *
 * Guarantees schema adherence (FR-2.4) and neutralizes potential XSS injection vectors.
 */

import { CertificateMetadata, TemplateMetadataRef, CustomMetadataRef } from '../types/certificate';

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly sanitizedData?: CertificateMetadata;
}

/**
 * Strips dangerous HTML tags and control characters to prevent XSS.
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * Validates whether a string is a valid ISO-8601 date.
 */
export function isValidIsoDate(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validates an Ethereum hex address format.
 */
export function isValidEthereumAddress(address: string): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates and sanitizes certificate metadata schema (FR-2.4).
 */
export function validateAndSanitizeMetadata(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Metadata must be a non-null object.'] };
  }

  const raw = data as Record<string, unknown>;

  if (raw.schemaVersion !== '1.0') {
    errors.push('Invalid or missing schemaVersion (must be "1.0").');
  }

  const certificateTitle = sanitizeString(String(raw.certificateTitle || ''));
  if (!certificateTitle) {
    errors.push('Certificate title is required.');
  }

  const recipientName = sanitizeString(String(raw.recipientName || ''));
  if (!recipientName) {
    errors.push('Recipient name is required.');
  }

  const recipientIdentifier = sanitizeString(String(raw.recipientIdentifier || ''));
  if (!recipientIdentifier) {
    errors.push('Recipient identifier (address or email) is required.');
  }

  const issuerName = sanitizeString(String(raw.issuerName || ''));
  if (!issuerName) {
    errors.push('Issuer name is required.');
  }

  const issuerAddress = String(raw.issuerAddress || '').trim();
  if (!issuerAddress || !isValidEthereumAddress(issuerAddress)) {
    errors.push('Valid issuer Ethereum address is required.');
  }

  const issueDate = String(raw.issueDate || '').trim();
  if (!issueDate || !isValidIsoDate(issueDate)) {
    errors.push('Valid ISO-8601 issue date is required.');
  }

  let expiryDate: string | null = null;
  if (raw.expiryDate) {
    const rawExp = String(raw.expiryDate).trim();
    if (!isValidIsoDate(rawExp)) {
      errors.push('Invalid ISO-8601 expiry date.');
    } else {
      expiryDate = new Date(rawExp).toISOString();
    }
  }

  const description = sanitizeString(String(raw.description || ''));

  let additionalFields: Record<string, string> | undefined;
  if (raw.additionalFields && typeof raw.additionalFields === 'object') {
    additionalFields = {};
    for (const [key, val] of Object.entries(raw.additionalFields as Record<string, unknown>)) {
      const cleanKey = sanitizeString(key);
      const cleanVal = sanitizeString(String(val ?? ''));
      if (cleanKey) {
        additionalFields[cleanKey] = cleanVal;
      }
    }
  }

  // Additive validation for custom template reference
  let template: TemplateMetadataRef | undefined;
  if (raw.template && typeof raw.template === 'object') {
    const t = raw.template as Record<string, unknown>;
    if (t.schema !== 'certichain.template/v1') {
      errors.push('Invalid template schema (must be "certichain.template/v1").');
    }
    if (!t.cid || typeof t.cid !== 'string') {
      errors.push('Template CID is required.');
    }
    if (!t.sha256 || typeof t.sha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(t.sha256)) {
      errors.push('Template sha256 hash must be a 64-character hex string.');
    }
    template = {
      schema: 'certichain.template/v1',
      cid: String(t.cid),
      sha256: String(t.sha256).toLowerCase(),
      name: sanitizeString(String(t.name || 'Custom Template')),
    };
  }

  let templateValues: Record<string, string> | undefined;
  if (raw.templateValues && typeof raw.templateValues === 'object') {
    templateValues = {};
    for (const [key, val] of Object.entries(raw.templateValues as Record<string, unknown>)) {
      const cleanKey = sanitizeString(key);
      const cleanVal = sanitizeString(String(val ?? ''));
      if (cleanKey) {
        templateValues[cleanKey] = cleanVal;
      }
    }
  }

  // Additive validation for custom certificate block
  let custom: CustomMetadataRef | undefined;
  if (raw.custom && typeof raw.custom === 'object') {
    const c = raw.custom as Record<string, unknown>;
    if (c.schemaVersion !== 1) {
      errors.push('Invalid custom schemaVersion (must be 1).');
    }
    if (!c.templateHash || typeof c.templateHash !== 'string') {
      errors.push('custom.templateHash is required.');
    }
    let sanitizedValues: Record<string, string> | undefined;
    if (c.values && typeof c.values === 'object') {
      sanitizedValues = {};
      for (const [k, v] of Object.entries(c.values as Record<string, unknown>)) {
        const cleanK = sanitizeString(k);
        const cleanV = sanitizeString(String(v ?? ''));
        if (cleanK) {
          sanitizedValues[cleanK] = cleanV;
        }
      }
    }
    custom = {
      schemaVersion: 1,
      templateHash: String(c.templateHash),
      ...(c.templateCid ? { templateCid: sanitizeString(String(c.templateCid)) } : {}),
      ...(c.baseHash ? { baseHash: String(c.baseHash).toLowerCase() } : {}),
      ...(c.baseCid ? { baseCid: sanitizeString(String(c.baseCid)) } : {}),
      ...(c.renderedCid ? { renderedCid: sanitizeString(String(c.renderedCid)) } : {}),
      ...(c.renderedHash ? { renderedHash: String(c.renderedHash).toLowerCase() } : {}),
      ...(c.layoutHash ? { layoutHash: String(c.layoutHash).toLowerCase() } : {}),
      ...(sanitizedValues && Object.keys(sanitizedValues).length > 0 ? { values: sanitizedValues } : {}),
    };
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const sanitizedData: CertificateMetadata = {
    schemaVersion: '1.0',
    certificateTitle,
    recipientName,
    recipientIdentifier,
    issuerName,
    issuerAddress,
    issueDate: new Date(issueDate).toISOString(),
    expiryDate,
    description,
    ...(additionalFields && Object.keys(additionalFields).length > 0 ? { additionalFields } : {}),
    ...(template ? { template } : {}),
    ...(templateValues && Object.keys(templateValues).length > 0 ? { templateValues } : {}),
    ...(custom ? { custom } : {}),
  };

  return { isValid: true, errors: [], sanitizedData };
}
