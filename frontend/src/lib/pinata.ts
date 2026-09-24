/**
 * @file pinata.ts
 * @summary Single Responsibility: Manages IPFS JSON pinning via serverless proxy and gateway resolution.
 *
 * Implements exponential backoff retry (FR-2.5) and gateway fallbacks (FR-2.3).
 */

import { CONFIG } from '../config';
import { CertificateMetadata } from '../types/certificate';

export interface PinataPinResult {
  readonly ipfsHash: string; // CID
  readonly pinSize: number;
  readonly timestamp: string;
  readonly metadataUrl: string;
}

/**
 * Pins canonical certificate JSON to IPFS with exponential backoff retry (FR-2.2, FR-2.5).
 * Calls serverless /api/pinJson route to keep PINATA_JWT safe.
 */
export async function pinMetadataToIpfs(
  metadata: CertificateMetadata,
  maxAttempts = 3,
  initialDelay = 1000
): Promise<PinataPinResult> {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/pinJson', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Pinning failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to pin JSON to IPFS`);
      }

      const data = await response.json();
      const ipfsHash = data.IpfsHash || data.ipfsHash;

      if (!ipfsHash) {
        throw new Error('Pinata response did not contain an IpfsHash CID.');
      }

      const metadataUrl = constructGatewayUrl(ipfsHash);

      return {
        ipfsHash,
        pinSize: data.PinSize || 0,
        timestamp: data.Timestamp || new Date().toISOString(),
        metadataUrl,
      };
    } catch (err: unknown) {
      console.warn(`Pinning attempt ${attempt} failed:`, err);
      if (attempt >= maxAttempts) {
        const message = err instanceof Error ? err.message : 'Unknown error during IPFS pinning';
        throw new Error(`Failed to pin metadata to IPFS after ${maxAttempts} attempts: ${message}`);
      }
      // Wait with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  throw new Error(`Failed to pin metadata after ${maxAttempts} attempts.`);
}

/**
 * Constructs an IPFS gateway URL from a CID or ipfs:// URI (FR-2.3).
 */
export function constructGatewayUrl(cidOrUri: string, useFallback = false): string {
  const cid = cidOrUri.replace('ipfs://', '').replace(/^ipfs\//, '');
  const baseUrl = useFallback ? CONFIG.fallbackGateway : CONFIG.pinataGateway;
  const sanitizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${sanitizedBase}${cid}`;
}

/**
 * Fetches JSON metadata from IPFS with fallback gateway support (FR-4.2).
 */
export async function fetchMetadataFromIpfs(metadataUrlOrCid: string): Promise<CertificateMetadata> {
  const cid = metadataUrlOrCid.startsWith('http')
    ? metadataUrlOrCid.split('/ipfs/')[1] || metadataUrlOrCid
    : metadataUrlOrCid.replace('ipfs://', '');

  const primaryUrl = constructGatewayUrl(cid, false);
  const fallbackUrl = constructGatewayUrl(cid, true);

  try {
    const response = await fetch(primaryUrl);
    if (!response.ok) throw new Error(`Primary gateway HTTP ${response.status}`);
    return (await response.json()) as CertificateMetadata;
  } catch (primaryErr) {
    try {
      const fallbackResponse = await fetch(fallbackUrl);
      if (fallbackResponse.ok) {
        return (await fallbackResponse.json()) as CertificateMetadata;
      }
    } catch {
      // Fall through to local dev middleware
    }

    // Try local dev server middleware route (/ipfs/:cid)
    try {
      const localResponse = await fetch(`/ipfs/${cid}`);
      if (localResponse.ok) {
        return (await localResponse.json()) as CertificateMetadata;
      }
    } catch {
      // Ignore
    }

    throw new Error(`Unable to fetch IPFS metadata for CID ${cid} from gateways or local store.`);
  }
}
