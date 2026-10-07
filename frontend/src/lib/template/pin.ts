/**
 * @file pin.ts
 * @summary Pins TemplateSpec JSON to IPFS via the existing pinMetadataToIpfs helper,
 * calculating canonical sha256 hash and caching CIDs in IndexedDB.
 */

import { TemplateSpec } from './types';
import { computeProofHash } from '../hash';
import { pinMetadataToIpfs } from '../pinata';
import { getCachedCid, setCachedCid } from './store';

export interface PinTemplateResult {
  cid: string;
  sha256: string;
  cached: boolean;
}

/**
 * Computes the canonical SHA-256 hash (64-character lowercase hex) of a TemplateSpec object.
 */
export async function computeTemplateSha256(spec: TemplateSpec): Promise<string> {
  const proofHash = await computeProofHash(spec);
  return proofHash.replace(/^0x/i, '').toLowerCase();
}

/**
 * Pins a TemplateSpec to IPFS (reusing cached CID if already pinned).
 */
export async function pinTemplateToIpfs(
  spec: TemplateSpec,
  onStatus?: (msg: string) => void
): Promise<PinTemplateResult> {
  const sha256 = await computeTemplateSha256(spec);

  // Check if CID is already cached in IndexedDB
  const cachedCid = await getCachedCid(sha256);
  if (cachedCid) {
    onStatus?.('Template already pinned on IPFS (cached)');
    return {
      cid: cachedCid,
      sha256,
      cached: true,
    };
  }

  onStatus?.('Pinning certificate template to IPFS...');
  const pinResult = await pinMetadataToIpfs(spec as any);

  // Store in cache for future issuances
  await setCachedCid(sha256, pinResult.ipfsHash);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`certichain_ipfs_${pinResult.ipfsHash}`, JSON.stringify(spec));
      window.localStorage.setItem(`certichain_ipfs_${sha256}`, JSON.stringify(spec));
    } catch {}
  }

  return {
    cid: pinResult.ipfsHash,
    sha256,
    cached: false,
  };
}
