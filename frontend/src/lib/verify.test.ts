import { describe, it, expect } from 'vitest';
import { verifyCertificateIntegrity } from './verify';
import { computeProofHash } from './hash';
import { computeTemplateSha256 } from './template/pin';
import { SAMPLE_TEMPLATE_SPEC } from './template/sampleSpec';
import { CertificateMetadata, OnChainCertificate } from '../types/certificate';

describe('verify.ts cryptographic verification engine with template support', () => {
  const baseMetadata: CertificateMetadata = {
    schemaVersion: '1.0',
    certificateTitle: 'Master in Blockchain Architecture',
    recipientName: 'Alice Nakamoto',
    recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    issuerName: 'Decentralized Academic Consortium',
    issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    issueDate: '2026-07-10T00:00:00.000Z',
    expiryDate: null,
    description: 'Completion with distinction.',
  };

  it('verifies legacy non-template certificate successfully as VALID', async () => {
    const proofHash = await computeProofHash(baseMetadata);
    const onChainCert: OnChainCertificate = {
      issuer: baseMetadata.issuerAddress,
      recipient: baseMetadata.recipientIdentifier,
      proofHash,
      metadataUrl: `https://gateway.pinata.cloud/ipfs/QmLegacy123`,
      issuedAt: 1783728000n,
      revoked: false,
      revokedAt: 0n,
    };

    const res = await verifyCertificateIntegrity({
      certId: proofHash,
      onChainCert,
      isAuthorized: true,
      metadataOverride: baseMetadata,
    });

    expect(res.state).toBe('VALID');
    expect(res.templateSpec).toBeNull();
  });

  it('verifies valid template certificate with matching cryptographic hash', async () => {
    const templateSha = await computeTemplateSha256(SAMPLE_TEMPLATE_SPEC);
    const templateMetadata: CertificateMetadata = {
      ...baseMetadata,
      template: {
        schema: 'certichain.template/v1',
        cid: 'QmSampleTemplateCid',
        sha256: templateSha,
        name: SAMPLE_TEMPLATE_SPEC.name,
      },
      templateValues: {
        recipient_name: 'Alice Nakamoto',
      },
    };

    const proofHash = await computeProofHash(templateMetadata);
    const onChainCert: OnChainCertificate = {
      issuer: templateMetadata.issuerAddress,
      recipient: templateMetadata.recipientIdentifier,
      proofHash,
      metadataUrl: `https://gateway.pinata.cloud/ipfs/QmTemplateMetadata`,
      issuedAt: 1783728000n,
      revoked: false,
      revokedAt: 0n,
    };

    const res = await verifyCertificateIntegrity({
      certId: proofHash,
      onChainCert,
      isAuthorized: true,
      metadataOverride: templateMetadata,
      templateOverride: SAMPLE_TEMPLATE_SPEC,
    });

    expect(res.state).toBe('VALID');
    expect(res.templateSpec).not.toBeNull();
  });

  it('detects tampered template hash as INVALID_TAMPERED', async () => {
    const templateMetadata: CertificateMetadata = {
      ...baseMetadata,
      template: {
        schema: 'certichain.template/v1',
        cid: 'QmSampleTemplateCid',
        sha256: '0000000000000000000000000000000000000000000000000000000000000000', // Fake hash
        name: SAMPLE_TEMPLATE_SPEC.name,
      },
      templateValues: {
        recipient_name: 'Alice Nakamoto',
      },
    };

    const proofHash = await computeProofHash(templateMetadata);
    const onChainCert: OnChainCertificate = {
      issuer: templateMetadata.issuerAddress,
      recipient: templateMetadata.recipientIdentifier,
      proofHash,
      metadataUrl: `https://gateway.pinata.cloud/ipfs/QmTampered`,
      issuedAt: 1783728000n,
      revoked: false,
      revokedAt: 0n,
    };

    const res = await verifyCertificateIntegrity({
      certId: proofHash,
      onChainCert,
      isAuthorized: true,
      metadataOverride: templateMetadata,
      templateOverride: SAMPLE_TEMPLATE_SPEC,
    });

    expect(res.state).toBe('INVALID_TAMPERED');
    expect(res.errorReason).toContain('Template does not match the issued record');
  });

  it('returns UNVERIFIABLE when template is unreachable', async () => {
    const templateMetadata: CertificateMetadata = {
      ...baseMetadata,
      template: {
        schema: 'certichain.template/v1',
        cid: 'QmUnreachableCid999999999',
        sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
        name: 'Missing Template',
      },
    };

    const proofHash = await computeProofHash(templateMetadata);
    const onChainCert: OnChainCertificate = {
      issuer: templateMetadata.issuerAddress,
      recipient: templateMetadata.recipientIdentifier,
      proofHash,
      metadataUrl: `https://gateway.pinata.cloud/ipfs/QmUnreachable`,
      issuedAt: 1783728000n,
      revoked: false,
      revokedAt: 0n,
    };

    const res = await verifyCertificateIntegrity({
      certId: proofHash,
      onChainCert,
      isAuthorized: true,
      metadataOverride: templateMetadata,
    });

    expect(res.state).toBe('UNVERIFIABLE');
    expect(res.errorReason).toContain('Template');
  });
});
