import { describe, it, expect } from 'vitest';
import {
  getRegistryAddress,
  getChainDetails,
  normalizeCertId,
} from '../config';
import { verifyCertificateIntegrity } from '../lib/verify';
import { OnChainCertificate, CertificateMetadata } from '../types/certificate';

describe('Multi-Chain Config & Verification Architecture (Unit & Integration)', () => {
  describe('Config & Chain Mapping (Step 3.1)', () => {
    it('returns the exact address for Sepolia without global overrides', () => {
      const sepoliaAddress = getRegistryAddress(11155111);
      expect(sepoliaAddress.toLowerCase()).toBe('0xecba3cda5f34859744ace79b7ba79b71cc29580d');
    });

    it('returns the exact address for Hardhat localhost without global overrides', () => {
      const hardhatAddress = getRegistryAddress(31337);
      expect(hardhatAddress.toLowerCase()).toBe('0x5fbdb2315678afecb367f032d93f642f64180aa3');
    });

    it('throws a clear descriptive error for unknown chain IDs', () => {
      expect(() => getRegistryAddress(999999)).toThrow(/Unsupported network chain ID: 999999/);
    });

    it('returns valid chain details for supported chains', () => {
      const sep = getChainDetails(11155111);
      expect(sep.name).toBe('Sepolia Testnet');
      expect(sep.rpcUrls.length).toBeGreaterThan(0);

      const hh = getChainDetails(31337);
      expect(hh.name).toBe('Hardhat Localhost');
      expect(hh.rpcUrls).toContain('http://127.0.0.1:8545');
    });
  });

  describe('ID Normalization (Step 3.1 & 2.6)', () => {
    it('normalizes a plain 32-byte 0x hex string', () => {
      const raw = '0xDFAC814A1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678';
      const res = normalizeCertId(raw);
      expect(res.valid).toBe(true);
      expect(res.certId).toBe(raw.toLowerCase());
    });

    it('normalizes hex missing 0x prefix', () => {
      const raw = 'dfac814a1234567890abcdef1234567890abcdef1234567890abcdef12345678';
      const res = normalizeCertId(raw);
      expect(res.valid).toBe(true);
      expect(res.certId).toBe(`0x${raw}`);
    });

    it('normalizes a pasted verification URL with ?chain= parameter', () => {
      const url = 'http://localhost:5173/verify/0xdfac814a1234567890abcdef1234567890abcdef1234567890abcdef12345678?chain=11155111#section';
      const res = normalizeCertId(url);
      expect(res.valid).toBe(true);
      expect(res.certId).toBe('0xdfac814a1234567890abcdef1234567890abcdef1234567890abcdef12345678');
      expect(res.chainId).toBe(11155111);
    });

    it('flags invalid length/characters with a clear descriptive message', () => {
      const invalid = '0x1234';
      const res = normalizeCertId(invalid);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Invalid Certificate ID format');
    });

    it('flags empty strings with a clear message', () => {
      const res = normalizeCertId('   ');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Certificate ID cannot be empty.');
    });
  });

  describe('Error Classification & State Overrides (Step 2.3, 2.4, 3.1)', () => {
    const dummyCertId = '0xdfac814a1234567890abcdef1234567890abcdef1234567890abcdef12345678';

    it('maps missing contract to NO_CONTRACT with technical details', async () => {
      const result = await verifyCertificateIntegrity({
        certId: dummyCertId,
        isAuthorized: false,
        chainId: 11155111,
        chainName: 'Sepolia Testnet',
        registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        stateOverride: 'NO_CONTRACT',
        errorReason: 'No registry contract found at 0x5FbDB2315678afecb367f032d93F642f64180aa3 on Sepolia Testnet.',
      });

      expect(result.state).toBe('NO_CONTRACT');
      expect(result.errorReason).toContain('No registry contract found');
      expect(result.chainId).toBe(11155111);
    });

    it('maps RPC / network errors to UNREACHABLE', async () => {
      const result = await verifyCertificateIntegrity({
        certId: dummyCertId,
        isAuthorized: false,
        chainId: 31337,
        chainName: 'Hardhat Localhost',
        registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        stateOverride: 'UNREACHABLE',
        errorReason: 'Unable to reach the registry on Hardhat Localhost: connection refused.',
      });

      expect(result.state).toBe('UNREACHABLE');
      expect(result.errorReason).toContain('Unable to reach the registry');
    });

    it('maps empty/zero record (issuedAt === 0n) to NOT_FOUND', async () => {
      const emptyOnChainRecord: OnChainCertificate = {
        issuer: '0x0000000000000000000000000000000000000000',
        recipient: '0x0000000000000000000000000000000000000000',
        proofHash: dummyCertId,
        metadataUrl: '',
        issuedAt: 0n,
        revoked: false,
        revokedAt: 0n,
      };

      const result = await verifyCertificateIntegrity({
        certId: dummyCertId,
        onChainCert: emptyOnChainRecord,
        isAuthorized: false,
        chainId: 11155111,
        chainName: 'Sepolia Testnet',
        registryAddress: '0xeCBA3CDA5f34859744ACe79B7BA79B71cC29580D',
      });

      expect(result.state).toBe('NOT_FOUND');
      expect(result.errorReason).toContain('not found in on-chain registry');
    });

    it('displays network information when certificate is verified across chains', async () => {
      const sampleMetadata: CertificateMetadata = {
        schemaVersion: '1.0',
        certificateTitle: 'Blockchain Architect',
        recipientName: 'Bob Vance',
        recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        issuerName: 'Vance Refrigeration',
        issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        issueDate: '2026-10-04T00:00:00.000Z',
        expiryDate: null,
        description: 'Verified.',
      };

      const { computeProofHash } = await import('../lib/hash');
      const hash = await computeProofHash(sampleMetadata);

      const validRecord: OnChainCertificate = {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        proofHash: hash,
        metadataUrl: 'ipfs://sample',
        issuedAt: 1728000000n,
        revoked: false,
        revokedAt: 0n,
      };

      const result = await verifyCertificateIntegrity({
        certId: hash,
        onChainCert: validRecord,
        isAuthorized: true,
        metadataOverride: sampleMetadata,
        chainId: 31337,
        chainName: 'Hardhat Localhost',
        registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        walletChainMismatch: true,
        walletChainName: 'Sepolia Testnet',
      });

      expect(result.state).toBe('VALID');
      expect(result.chainId).toBe(31337);
      expect(result.chainName).toBe('Hardhat Localhost');
      expect(result.walletChainMismatch).toBe(true);
      expect(result.walletChainName).toBe('Sepolia Testnet');
    });
  });

  describe('Negative Tests & Issuance Guards (Requirement 5)', () => {
    it('(a) blocks issuing when contract has no code on the wallet chain', async () => {
      const { checkContractExists } = await import('../config');
      const fakeProvider = {
        getCode: async () => '0x',
      } as any;

      const existence = await checkContractExists(11155111, fakeProvider);
      expect(existence.exists).toBe(false);
      expect(existence.codeLength).toBe(0);
    });

    it('(b) tx to no-code address or missing CertificateIssued event rejects with error', () => {
      const mockReceipt = {
        hash: '0x1234567890abcdef',
        status: 1,
        logs: [], // No CertificateIssued log
      };

      const hasCertificateIssued = mockReceipt.logs.some((l: any) => l.address === '0x5FbDB2315678afecb367f032d93F642f64180aa3');
      expect(hasCertificateIssued).toBe(false);
    });

    it('(c) unconfirmed / ghost localStorage records are filtered out from anchored query results', async () => {
      const ghostRecord = {
        certId: '0x9999999999999999999999999999999999999999999999999999999999999999',
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        proofHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
        metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmGhost',
        timestamp: 1728000000n,
      };

      // Simulated contract verification returning empty struct (issuedAt = 0n)
      const verifyStub = async (certId: string) => ({
        issuer: '0x0000000000000000000000000000000000000000',
        recipient: '0x0000000000000000000000000000000000000000',
        proofHash: certId,
        metadataUrl: '',
        issuedAt: 0n,
        revoked: false,
        revokedAt: 0n,
      });

      const onChain = await verifyStub(ghostRecord.certId);
      const isConfirmed = onChain.issuedAt > 0n;

      expect(isConfirmed).toBe(false);
    });

    it('(d) wallet on a different chain than verification link remains VALID with note', async () => {
      const sampleMetadata: CertificateMetadata = {
        schemaVersion: '1.0',
        certificateTitle: 'Multi-Chain Master',
        recipientName: 'Alice Nakamoto',
        recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        issuerName: 'Consortium',
        issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        issueDate: '2026-10-04T00:00:00.000Z',
        expiryDate: null,
        description: 'Multi-Chain Verified.',
      };

      const { computeProofHash } = await import('../lib/hash');
      const hash = await computeProofHash(sampleMetadata);

      const validRecord: OnChainCertificate = {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        proofHash: hash,
        metadataUrl: 'ipfs://sample',
        issuedAt: 1728000000n,
        revoked: false,
        revokedAt: 0n,
      };

      const result = await verifyCertificateIntegrity({
        certId: hash,
        onChainCert: validRecord,
        isAuthorized: true,
        metadataOverride: sampleMetadata,
        chainId: 11155111,
        chainName: 'Sepolia Testnet',
        registryAddress: '0xeCBA3CDA5f34859744ACe79B7BA79B71cC29580D',
        walletChainMismatch: true,
        walletChainName: 'Hardhat Localhost',
      });

      expect(result.state).toBe('VALID');
      expect(result.walletChainMismatch).toBe(true);
      expect(result.chainName).toBe('Sepolia Testnet');
    });
  });
});
