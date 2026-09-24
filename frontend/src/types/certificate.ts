/**
 * Certificate Data Models
 * Defines IPFS JSON metadata schema and on-chain struct models.
 */

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

export type VerificationState = 'VALID' | 'REVOKED' | 'INVALID_TAMPERED' | 'NOT_FOUND';

export interface VerificationResultData {
  readonly state: VerificationState;
  readonly certId: string;
  readonly onChain?: OnChainCertificate;
  readonly metadata?: CertificateMetadata;
  readonly computedProofHash?: string;
  readonly isIssuerAuthorized?: boolean;
  readonly errorReason?: string;
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
}
