/**
 * @file verify.ts
 * @summary Single Responsibility: Cryptographically verifies certificate authenticity against on-chain state and IPFS metadata.
 *
 * Steps:
 * 1. Fetch on-chain record via verifyCertificate(certId).
 * 2. If issuedAt == 0 -> NOT_FOUND / INVALID.
 * 3. Fetch pinned metadata from IPFS via gateway (with fallback).
 * 4. Recompute canonical SHA-256 proof hash client-side.
 * 5. Compare recomputed hash with on-chain proofHash.
 * 6. Evaluate revocation state and issuer authorization.
 */

import { fetchMetadataFromIpfs } from './pinata';
import { computeProofHash } from './hash';
import { OnChainCertificate, CertificateMetadata, VerificationResultData } from '../types/certificate';

export interface VerifyParams {
  certId: string;
  onChainCert: OnChainCertificate;
  isAuthorized: boolean;
  metadataOverride?: CertificateMetadata;
}

export async function verifyCertificateIntegrity({
  certId,
  onChainCert,
  isAuthorized,
  metadataOverride,
}: VerifyParams): Promise<VerificationResultData> {
  // Case 1: Certificate does not exist on-chain
  if (!onChainCert || onChainCert.issuedAt === 0n) {
    return {
      state: 'INVALID_TAMPERED',
      certId,
      errorReason: 'Certificate not found in on-chain registry.',
      isIssuerAuthorized: false,
    };
  }

  let metadata = metadataOverride;

  if (!metadata && onChainCert.metadataUrl) {
    try {
      metadata = await fetchMetadataFromIpfs(onChainCert.metadataUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve IPFS metadata';
      return {
        state: 'INVALID_TAMPERED',
        certId,
        onChain: onChainCert,
        errorReason: `IPFS metadata unreachable: ${message}`,
        isIssuerAuthorized: isAuthorized,
      };
    }
  }

  if (!metadata) {
    return {
      state: 'INVALID_TAMPERED',
      certId,
      onChain: onChainCert,
      errorReason: 'Unable to resolve certificate metadata.',
      isIssuerAuthorized: isAuthorized,
    };
  }

  // Compute proof hash from canonicalized metadata (Decision 2.8)
  const computedHash = await computeProofHash(metadata);
  const hashMatches =
    computedHash.toLowerCase() === onChainCert.proofHash.toLowerCase() &&
    computedHash.toLowerCase() === certId.toLowerCase();

  // Case 2: Cryptographic Tampering Detected
  if (!hashMatches) {
    return {
      state: 'INVALID_TAMPERED',
      certId,
      onChain: onChainCert,
      metadata,
      computedProofHash: computedHash,
      isIssuerAuthorized: isAuthorized,
      errorReason: `Cryptographic proof hash mismatch. On-chain: ${onChainCert.proofHash}, Computed: ${computedHash}`,
    };
  }

  // Case 3: Revoked Certificate
  if (onChainCert.revoked) {
    return {
      state: 'REVOKED',
      certId,
      onChain: onChainCert,
      metadata,
      computedProofHash: computedHash,
      isIssuerAuthorized: isAuthorized,
    };
  }

  // Case 4: Valid Certificate
  return {
    state: 'VALID',
    certId,
    onChain: onChainCert,
    metadata,
    computedProofHash: computedHash,
    isIssuerAuthorized: isAuthorized,
  };
}
