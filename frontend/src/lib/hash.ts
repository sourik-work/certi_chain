/**
 * @file hash.ts
 * @summary Single Responsibility: Computes cryptographic SHA-256 proof hashes from canonicalized certificate payloads.
 *
 * Utilizes the standard SubtleCrypto API (FR-2.1) without any server-side round-trip.
 */

import { canonicalize } from './canonicalize';

/**
 * Computes a standard 0x-prefixed 32-byte hex SHA-256 hash of canonicalized JSON.
 * @param metadata Certificate metadata object or raw payload
 * @returns 0x-prefixed 64-character hex string (bytes32 format for EVM)
 */
export async function computeProofHash(metadata: unknown): Promise<string> {
  const canonicalString = canonicalize(metadata);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString);

  // SubtleCrypto in browser or Node environment
  const subtleCrypto =
    typeof window !== 'undefined' && window.crypto && window.crypto.subtle
      ? window.crypto.subtle
      : (await import('crypto')).webcrypto.subtle;

  const hashBuffer = await subtleCrypto.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `0x${hexHash}`;
}

/**
 * Synchronous / helper string verification to re-hash a raw JSON string
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
