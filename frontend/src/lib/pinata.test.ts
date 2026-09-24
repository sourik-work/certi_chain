import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pinMetadataToIpfs, constructGatewayUrl } from './pinata';
import { CertificateMetadata } from '../types/certificate';

describe('pinata client & gateway resolution', () => {
  const sampleMetadata: CertificateMetadata = {
    schemaVersion: '1.0',
    certificateTitle: 'Diploma in Blockchain',
    recipientName: 'Charlie',
    recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    issuerName: 'Acme Institute',
    issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    issueDate: '2026-09-24T00:00:00.000Z',
    expiryDate: null,
    description: 'Successful completion of certified curriculum.',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs correct gateway URLs with and without fallback', () => {
    const cid = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';
    const primary = constructGatewayUrl(cid, false);
    const fallback = constructGatewayUrl(cid, true);

    expect(primary).toContain(cid);
    expect(fallback).toContain('ipfs.io/ipfs/');
  });

  it('successfully pins metadata and returns CID and gateway URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        IpfsHash: 'QmTestCID123456789',
        PinSize: 512,
        Timestamp: '2026-09-24T00:00:00.000Z',
      }),
    });

    global.fetch = mockFetch;

    const result = await pinMetadataToIpfs(sampleMetadata);

    expect(result.ipfsHash).toBe('QmTestCID123456789');
    expect(result.metadataUrl).toContain('QmTestCID123456789');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/pinJson',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('retries on failure with exponential backoff up to maxAttempts', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: 'Service Unavailable' }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          IpfsHash: 'QmSuccessOnAttempt3',
          PinSize: 512,
          Timestamp: '2026-09-24T00:00:00.000Z',
        }),
      };
    });

    global.fetch = mockFetch;

    const result = await pinMetadataToIpfs(sampleMetadata, 3, 1);
    expect(result.ipfsHash).toBe('QmSuccessOnAttempt3');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws descriptive error when all retry attempts fail', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    });

    global.fetch = mockFetch;

    await expect(pinMetadataToIpfs(sampleMetadata, 2, 1, false)).rejects.toThrow(
      /Failed to pin metadata to IPFS after 2 attempts/
    );
  });
});
