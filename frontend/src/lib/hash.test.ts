import { describe, it, expect } from 'vitest';
import { computeProofHash } from './hash';

describe('hash pipeline', () => {
  const samplePayload1 = {
    schemaVersion: '1.0',
    certificateTitle: 'Certified Smart Contract Auditor',
    recipientName: 'Alice Developer',
    recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    issuerName: 'Web3 Academy',
    issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    issueDate: '2026-09-24T00:00:00.000Z',
    expiryDate: null,
    description: 'High distinction in EVM bytecode and security.',
  };

  const samplePayloadKeyReordered = {
    description: 'High distinction in EVM bytecode and security.',
    issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    schemaVersion: '1.0',
    issueDate: '2026-09-24T00:00:00.000Z',
    recipientName: 'Alice Developer',
    expiryDate: null,
    certificateTitle: 'Certified Smart Contract Auditor',
    issuerName: 'Web3 Academy',
    recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  };

  it('produces identical 0x-prefixed 32-byte hash regardless of key insertion order', async () => {
    const hash1 = await computeProofHash(samplePayload1);
    const hash2 = await computeProofHash(samplePayloadKeyReordered);

    expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
  });

  it('produces identical hash when issuedProofHash is attached vs omitted', async () => {
    const hashBase = await computeProofHash(samplePayload1);
    const hashWithProof = await computeProofHash({
      ...samplePayload1,
      issuedProofHash: hashBase,
    });

    expect(hashWithProof).toBe(hashBase);
  });

  it('detects tampering and produces completely different hash on single-character mutation', async () => {
    const originalHash = await computeProofHash(samplePayload1);

    const tamperedPayload = {
      ...samplePayload1,
      recipientName: 'Alice Developer!', // 1 char difference
    };

    const tamperedHash = await computeProofHash(tamperedPayload);
    expect(tamperedHash).not.toBe(originalHash);
  });
});
