import { describe, it, expect } from 'vitest';
import { computeProofHash } from '../lib/hash';
import { verifyCertificateIntegrity } from '../lib/verify';
import { CertificateMetadata, OnChainCertificate } from '../types/certificate';

describe('End-to-End Verification Pipeline (Valid, Revoked, Tampered, Unverifiable)', () => {
  const validMetadata: CertificateMetadata = {
    schemaVersion: '1.0',
    certificateTitle: 'Master in Smart Contract Security',
    recipientName: 'Alice Nakamoto',
    recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    issuerName: 'Decentralized Academic Consortium',
    issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    issueDate: '2026-10-03T00:00:00.000Z',
    expiryDate: null,
    description: 'Conferred with highest distinction.',
    additionalFields: { Grade: 'Distinction (A+)' },
  };

  it('verifies an authentic certificate as VALID', async () => {
    const proofHash = await computeProofHash(validMetadata);
    const onChainRecord: OnChainCertificate = {
      issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      proofHash,
      metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmValidCID',
      issuedAt: 1727980000n,
      revoked: false,
      revokedAt: 0n,
    };

    const result = await verifyCertificateIntegrity({
      certId: proofHash,
      onChainCert: onChainRecord,
      isAuthorized: true,
      metadataOverride: validMetadata,
    });

    expect(result.state).toBe('VALID');
    expect(result.computedProofHash?.toLowerCase()).toBe(proofHash.toLowerCase());
    expect(result.isIssuerAuthorized).toBe(true);
  });

  it('verifies a revoked certificate as REVOKED', async () => {
    const proofHash = await computeProofHash(validMetadata);
    const onChainRecord: OnChainCertificate = {
      issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      proofHash,
      metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmValidCID',
      issuedAt: 1727980000n,
      revoked: true,
      revokedAt: 1727990000n,
    };

    const result = await verifyCertificateIntegrity({
      certId: proofHash,
      onChainCert: onChainRecord,
      isAuthorized: true,
      metadataOverride: validMetadata,
    });

    expect(result.state).toBe('REVOKED');
    expect(result.computedProofHash?.toLowerCase()).toBe(proofHash.toLowerCase());
  });

  it('detects tampering as INVALID_TAMPERED when metadata has been modified', async () => {
    const originalProofHash = await computeProofHash(validMetadata);

    const tamperedMetadata: CertificateMetadata = {
      ...validMetadata,
      recipientName: 'Mallory (Attacker)',
    };

    const onChainRecord: OnChainCertificate = {
      issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      proofHash: originalProofHash, // On-chain records original proofHash
      metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmTamperedCID',
      issuedAt: 1727980000n,
      revoked: false,
      revokedAt: 0n,
    };

    const result = await verifyCertificateIntegrity({
      certId: originalProofHash,
      onChainCert: onChainRecord,
      isAuthorized: true,
      metadataOverride: tamperedMetadata,
    });

    expect(result.state).toBe('INVALID_TAMPERED');
    expect(result.errorReason).toContain('Cryptographic proof hash mismatch');
  });

  it('returns UNVERIFIABLE when IPFS metadata cannot be fetched or resolved', async () => {
    const proofHash = await computeProofHash(validMetadata);
    const onChainRecord: OnChainCertificate = {
      issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      proofHash,
      metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmNonExistentUnreachableCID',
      issuedAt: 1727980000n,
      revoked: false,
      revokedAt: 0n,
    };

    // No metadataOverride and fetch will fail against non-existent URL
    const result = await verifyCertificateIntegrity({
      certId: proofHash,
      onChainCert: onChainRecord,
      isAuthorized: true,
    });

    expect(result.state).toBe('UNVERIFIABLE');
    expect(result.errorReason).toContain('IPFS metadata unreachable');
  });
});
