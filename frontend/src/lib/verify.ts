/**
 * @file verify.ts
 * @summary Cryptographic Certificate Verification Engine.
 *
 * Multi-Stage Verification Pipeline:
 * 1. On-Chain Existence: Queries the smart contract to ensure the certId exists (`issuedAt > 0`).
 * 2. Decentralized Metadata Resolution: Retrieves original JSON payload from IPFS via gateway fallback.
 * 3. Client-Side Cryptographic Hashing: Recomputes the SHA-256 hash from the canonicalized JSON in memory.
 * 4. Proof Hash Match: Asserts that computedHash === onChainCert.proofHash === certId.
 * 5. Lifecycle & Authorization Check: Checks if the certificate is REVOKED or if the issuer is whitelisted.
 */

import { fetchMetadataFromIpfs } from './pinata';
import { computeProofHash } from './hash';
import { OnChainCertificate, CertificateMetadata, VerificationResultData } from '../types/certificate';

/**
 * Parameters passed to the verification pipeline.
 */
export interface VerifyParams {
  /** Target certificate ID (proofHash) */
  certId: string;
  /** On-chain Certificate struct retrieved from smart contract */
  onChainCert: OnChainCertificate;
  /** Whether the issuing address is currently whitelisted by the registry owner */
  isAuthorized: boolean;
  /** Optional metadata payload override (e.g. from user-uploaded JSON file) */
  metadataOverride?: CertificateMetadata;
}

/**
 * Executes full cryptographic and on-chain verification of a credential.
 * @param params - Verification parameters.
 * @returns VerificationResultData with status: 'VALID' | 'REVOKED' | 'INVALID_TAMPERED'.
 */
export async function verifyCertificateIntegrity({
  certId,
  onChainCert,
  isAuthorized,
  metadataOverride,
}: VerifyParams): Promise<VerificationResultData> {
  // Stage 1: Check if certificate exists on the blockchain
  if (!onChainCert || onChainCert.issuedAt === 0n) {
    return {
      state: 'INVALID_TAMPERED',
      certId,
      errorReason: 'Certificate not found in on-chain registry.',
      isIssuerAuthorized: false,
    };
  }

  let metadata = metadataOverride;

  // Stage 2: Fetch metadata from IPFS if not already provided
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

  // Stage 3: Recompute the SHA-256 hash using RFC 8785 canonical serialization
  const computedHash = await computeProofHash(metadata);
  const hashMatches =
    computedHash.toLowerCase() === onChainCert.proofHash.toLowerCase() &&
    computedHash.toLowerCase() === certId.toLowerCase();

  // Stage 4: Detect any tampering or altered fields
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

  // Stage 5: Check if the certificate was revoked by issuer or contract owner
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

  // Stage 6: Certificate is Authentic, Unaltered, and Active
  return {
    state: 'VALID',
    certId,
    onChain: onChainCert,
    metadata,
    computedProofHash: computedHash,
    isIssuerAuthorized: isAuthorized,
  };
}

