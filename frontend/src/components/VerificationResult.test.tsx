import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerificationResult } from './VerificationResult';
import { VerificationResultData } from '../types/certificate';

describe('VerificationResult Component (Mandatory Tri-State Tests)', () => {
  const sampleCertId = '0x1111111111111111111111111111111111111111111111111111111111111111';

  it('renders VALID state with authentic status banner', () => {
    const validData: VerificationResultData = {
      state: 'VALID',
      certId: sampleCertId,
      isIssuerAuthorized: true,
      onChain: {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        proofHash: sampleCertId,
        metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmTest',
        issuedAt: 1727184000n,
        revoked: false,
        revokedAt: 0n,
      },
      metadata: {
        schemaVersion: '1.0',
        certificateTitle: 'Blockchain Architect',
        recipientName: 'Alice',
        recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        issuerName: 'Acme Academy',
        issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        issueDate: '2026-09-24T00:00:00.000Z',
        expiryDate: null,
        description: 'Completed architecture test',
      },
    };

    render(<VerificationResult result={validData} />);
    const heading = screen.getByTestId('verification-status-heading');
    expect(heading.textContent).toContain('AUTHENTIC & VALID CREDENTIAL');
    expect(screen.getByText(/Authorized Whitelist/i)).toBeInTheDocument();
  });

  it('renders REVOKED state with revocation notice', () => {
    const revokedData: VerificationResultData = {
      state: 'REVOKED',
      certId: sampleCertId,
      isIssuerAuthorized: true,
      onChain: {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        proofHash: sampleCertId,
        metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmTest',
        issuedAt: 1727184000n,
        revoked: true,
        revokedAt: 1727200000n,
      },
    };

    render(<VerificationResult result={revokedData} />);
    const heading = screen.getByTestId('verification-status-heading');
    expect(heading.textContent).toContain('CREDENTIAL HAS BEEN REVOKED');
  });

  it('renders INVALID/TAMPERED state on proof hash mismatch', () => {
    const tamperedData: VerificationResultData = {
      state: 'INVALID_TAMPERED',
      certId: sampleCertId,
      errorReason: 'Cryptographic proof hash mismatch.',
    };

    render(<VerificationResult result={tamperedData} />);
    const heading = screen.getByTestId('verification-status-heading');
    expect(heading.textContent).toContain('INVALID OR TAMPERED RECORD');
    expect(screen.getByText(/Cryptographic proof hash mismatch/i)).toBeInTheDocument();
  });
});
