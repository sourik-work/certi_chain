/**
 * Certificate Data Models
 * Defines IPFS JSON metadata schema and on-chain struct models.
 */

import type { TemplateSpec } from '../lib/template/types';

export interface TemplateMetadataRef {
  readonly schema: 'certichain.template/v1';
  readonly cid: string;
  readonly sha256: string;
  readonly name: string;
}

export interface CustomMetadataRef {
  readonly schemaVersion: 1;
  readonly templateHash: string; // SHA-256 of original template bytes
  readonly templateCid?: string; // IPFS CID of original template file
  readonly baseHash?: string; // SHA-256 of cleaned base template image
  readonly baseCid?: string; // IPFS CID of cleaned base template image
  readonly renderedCid?: string; // IPFS CID of final rendered PNG
  readonly renderedHash?: string; // SHA-256 of final rendered PNG
  readonly layoutHash?: string; // SHA-256 of canonicalized layout schema
  readonly values?: Record<string, string>;
}

export interface CertificateMetadata {
  readonly schemaVersion: '1.0';
  readonly certificateTitle: string;
  readonly recipientName: string;
  readonly recipientIdentifier: string; // address or email
  readonly issuerName: string;
  readonly issuerAddress: string;
  readonly issueDate: string; // ISO-8601 (e.g. "2026-09-24T00:00:00.000Z")
  readonly expiryDate: string | null; // ISO-8601 or null
  readonly description: string;
  readonly additionalFields?: Record<string, string>;
  readonly template?: TemplateMetadataRef;
  readonly templateValues?: Record<string, string>;
  readonly custom?: CustomMetadataRef;
  readonly issuedProofHash?: string; // Excluded from canonical hash input per Decision 2.8
}

export interface OnChainCertificate {
  readonly issuer: string;
  readonly recipient: string;
  readonly proofHash: string;
  readonly metadataUrl: string;
  readonly issuedAt: bigint;
  readonly revoked: boolean;
  readonly revokedAt: bigint;
}

export type VerificationState =
  | 'VALID'
  | 'REVOKED'
  | 'INVALID_TAMPERED'
  | 'INVALID_UNVERIFIABLE'
  | 'NOT_FOUND'
  | 'UNVERIFIABLE'
  | 'NO_CONTRACT'
  | 'UNREACHABLE';

export interface CustomIntegrityStatus {
  readonly valid: boolean;
  readonly templateValid: boolean;
  readonly baseValid?: boolean;
  readonly renderedValid: boolean;
  readonly layoutValid: boolean;
  readonly templateHashMatch?: boolean;
  readonly baseHashMatch?: boolean;
  readonly renderedHashMatch?: boolean;
  readonly details?: string;
}

export interface VerificationResultData {
  readonly state: VerificationState;
  readonly certId: string;
  readonly onChain?: OnChainCertificate;
  readonly metadata?: CertificateMetadata;
  readonly templateSpec?: TemplateSpec | null;
  readonly customIntegrity?: CustomIntegrityStatus;
  readonly renderedDataUrl?: string;
  readonly computedProofHash?: string;
  readonly isIssuerAuthorized?: boolean;
  readonly errorReason?: string;
  readonly chainId?: number;
  readonly chainName?: string;
  readonly registryAddress?: string;
  readonly walletChainMismatch?: boolean;
  readonly walletChainName?: string;
}

export interface IssuanceFormData {
  recipientName: string;
  recipientIdentifier: string;
  recipientAddress: string;
  certificateTitle: string;
  issuerName: string;
  description: string;
  issueDate: string;
  expiryDate: string;
  additionalFields: Array<{ key: string; value: string }>;
}

export interface IssuedCertificateRecord {
  readonly certId: string;
  readonly issuer: string;
  readonly recipient: string;
  readonly proofHash: string;
  readonly metadataUrl: string;
  readonly timestamp: bigint;
  readonly metadata?: CertificateMetadata;
  readonly templateSpec?: TemplateSpec | null;
}
