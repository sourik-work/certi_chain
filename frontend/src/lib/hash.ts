/**
 * @file hash.ts
 * @summary Cryptographic SHA-256 Proof Hash Generation.
 *
 * Core Guarantees:
 * - Uses native W3C Web Cryptography API (`window.crypto.subtle`) in browser environments.
 * - Falls back cleanly to Node.js `crypto.webcrypto.subtle` in server/test environments.
 * - Formats hashes as 0x-prefixed 64-hex-character strings compatible with EVM `bytes32` types.
 * - Reused identically across Issuance, Export, Recipient, and Verification modules.
 */

import { canonicalize } from './canonicalize';

/**
 * Computes a standard 0x-prefixed 32-byte hex SHA-256 hash of a canonicalized JSON metadata object.
 * @param metadata - Certificate metadata object or raw JSON structure.
 * @returns 0x-prefixed 64-character hex string (EVM `bytes32` proof hash).
 */
export async function computeProofHash(metadata: unknown): Promise<string> {
  // Step 1: Canonicalize object keys and structure to ensure bit-level determinism
  const canonicalString = canonicalize(metadata);

  // Step 2: Encode UTF-8 string into byte array
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString);

  // Step 3: Resolve platform SubtleCrypto implementation
  const subtleCrypto =
    typeof window !== 'undefined' && window.crypto && window.crypto.subtle
      ? window.crypto.subtle
      : (await import('crypto')).webcrypto.subtle;

  // Step 4: Digest raw bytes with SHA-256
  const hashBuffer = await subtleCrypto.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Step 5: Convert byte array into lowercase hexadecimal string
  const hexHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `0x${hexHash}`;
}

/**
 * Helper utility to hash an already-serialized string directly without re-canonicalizing.
 * @param text - The raw string to digest.
 * @returns 0x-prefixed 64-character hex string.
 */
export async function computeStringHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const subtleCrypto =
    typeof window !== 'undefined' && window.crypto && window.crypto.subtle
      ? window.crypto.subtle
      : (await import('crypto')).webcrypto.subtle;

  const hashBuffer = await subtleCrypto.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `0x${hexHash}`;
}

