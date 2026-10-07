/**
 * Serverless Session & Wallet Authentication
 * Handles cryptographic signature verification and authorized issuer gating.
 */

import { ethers } from 'ethers';

// In-memory nonce bucket with timestamp
const activeNonces = new Map<string, { nonce: string; timestamp: number }>();

export function generateNonce(address: string): string {
  const cleanAddr = address.toLowerCase();
  const nonce = `certichain-auth-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`;
  activeNonces.set(cleanAddr, { nonce, timestamp: Date.now() });
  return nonce;
}

export function getExpectedNonce(address: string): string | null {
  const cleanAddr = address.toLowerCase();
  const record = activeNonces.get(cleanAddr);
  if (!record) return null;

  // 15 minute expiry
  if (Date.now() - record.timestamp > 15 * 60 * 1000) {
    activeNonces.delete(cleanAddr);
    return null;
  }

  return record.nonce;
}

export function verifyWalletSignature(
  address: string,
  message: string,
  signature: string
): { isValid: boolean; error?: string } {
  try {
    if (!address || !message || !signature) {
      return { isValid: false, error: 'Missing address, message, or signature.' };
    }

    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return { isValid: false, error: 'Recovered address does not match claimed address.' };
    }

    return { isValid: true };
  } catch (err) {
    return { isValid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Simple in-memory rate limiter per IP / address
const requestBuckets = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(ipOrKey: string, maxRequests = 20, windowMs = 60000): boolean {
  const now = Date.now();
  const bucket = requestBuckets.get(ipOrKey);

  if (!bucket || now > bucket.resetTime) {
    requestBuckets.set(ipOrKey, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (bucket.count >= maxRequests) {
    return false;
  }

  bucket.count += 1;
  return true;
}
