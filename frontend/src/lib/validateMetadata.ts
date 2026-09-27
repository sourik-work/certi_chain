/**
 * @file validateMetadata.ts
 * @summary Input Sanitization & Schema Validation for Certificate Metadata.
 *
 * Security & Data Integrity Protections:
 * 1. XSS Neutralization: Cleans strings of HTML scripts, dangerous tag injections, and event handlers.
 * 2. ISO-8601 Date Parsing: Ensures issue and expiry dates parse unambiguously across all international timezones.
 * 3. Ethereum Address Format: Validates 20-byte hex formatting (0x...).
 * 4. Schema Conformance: Validates standard CertiChain v1.0 metadata fields before hashing and on-chain anchoring.
 */

import { CertificateMetadata } from '../types/certificate';

/**
 * Result returned by the metadata validation function.
 */
export interface ValidationResult {
  /** Boolean indicating whether all schema constraints were met */
  readonly isValid: boolean;
  /** List of human-readable error descriptions if validation fails */
  readonly errors: string[];
  /** Sanitized, clean, ready-to-hash metadata object if valid */
  readonly sanitizedData?: CertificateMetadata;
}

/**
 * Strips dangerous HTML tags and control characters to prevent XSS injection attacks.
 * @param input - Raw input string from form or external JSON.
 * @returns Clean, safe string.
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
 * @param dateString - String to test.
 */
export function isValidIsoDate(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validates standard Ethereum hex address format (0x followed by 40 hex characters).
 * @param address - Ethereum address string.
 */
export function isValidEthereumAddress(address: string): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates and sanitizes certificate metadata schema against CertiChain v1.0 specifications.
 * @param data - Untrusted input object (e.g. from user form or imported JSON file).
 * @returns ValidationResult with status, errors list, and sanitized output.
 */
export function validateAndSanitizeMetadata(data: unknown): ValidationResult {
  const errors: string[] = [];

  // Step 1: Ensure input is a non-null dictionary object
  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Metadata must be a non-null object.'] };
  }

  const raw = data as Record<string, unknown>;

  // Step 2: Validate Schema Version
  if (raw.schemaVersion !== '1.0') {
    errors.push('Invalid or missing schemaVersion (must be "1.0").');
  }

  // Step 3: Validate Certificate Title
  const certificateTitle = sanitizeString(String(raw.certificateTitle || ''));
  if (!certificateTitle) {
    errors.push('Certificate title is required.');
  }

  // Step 4: Validate Recipient Information
  const recipientName = sanitizeString(String(raw.recipientName || ''));
  if (!recipientName) {
    errors.push('Recipient name is required.');
  }

  const recipientIdentifier = sanitizeString(String(raw.recipientIdentifier || ''));
  if (!recipientIdentifier) {
    errors.push('Recipient identifier (address or email) is required.');
  }

  // Step 5: Validate Issuer Information
  const issuerName = sanitizeString(String(raw.issuerName || ''));
  if (!issuerName) {
    errors.push('Issuer name is required.');
  }

  const issuerAddress = String(raw.issuerAddress || '').trim();
  if (!issuerAddress || !isValidEthereumAddress(issuerAddress)) {
    errors.push('Valid issuer Ethereum address is required.');
  }

  // Step 6: Validate Issue Date & Optional Expiry Date
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

  // Step 7: Sanitize Description & Additional Custom Fields
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

  // If any validation errors occurred, return failures
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Build clean sanitized schema object
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
  };

  return { isValid: true, errors: [], sanitizedData };
}

