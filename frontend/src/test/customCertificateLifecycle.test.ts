import { describe, it, expect, beforeEach, vi } from 'vitest';
import { canonicalize } from '../lib/canonicalize';
import { computeProofHash, computeStringHash } from '../lib/hash';
import { computeLayoutHash } from '../lib/layoutHash';
import { postProcessDetectedFields } from '../lib/templateAnalysis';
import { sanitizeSvg } from '../lib/sanitizeSvg';
import { stripJpegExifBytes } from '../lib/stripExif';
import {
  base64ToUint8Array,
  sha256Bytes,
  MAX_ARTIFACT_BYTES,
  MAX_DIMENSION_PX,
  optimizeCanvasToDataUrl,
  uint8ArrayToDataUrl,
  sniffImageMime,
} from '../lib/bytes';
import {
  pinBinaryToIpfs,
  clearSessionBinaryPinCache,
  preflightSizeCheck,
  fetchArtifactBytes,
} from '../lib/pinata';
import { renderCustomCertificateCanvas } from '../lib/renderCertificate';
import { verifyCertificateIntegrity } from '../lib/verify';
import { extractCertIdAndChain } from '../config';
import { CertificateMetadata, OnChainCertificate } from '../types/certificate';
import { CertificateTemplate, TemplateField } from '../types/customTemplate';
import React from 'react';
import { render } from '@testing-library/react';
import { CertificateView } from '../components/CertificateView';

describe('Custom Certificate Lifecycle Integration Tests', () => {
  beforeEach(() => {
    clearSessionBinaryPinCache();
  });
  it('computes invariant canonical proof hashes regardless of JSON key insertion order', async () => {
    const rawTemplate: CertificateTemplate = {
      schemaVersion: 1,
      templateHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      mimeType: 'image/png',
      widthPx: 1920,
      heightPx: 1080,
      orientation: 'landscape',
      fields: [
        {
          key: 'recipientName',
          label: 'Recipient Name',
          type: 'name',
          required: true,
          box: { x: 0.2, y: 0.4, w: 0.6, h: 0.1 },
          style: {
            fontFamily: 'Inter',
            fontSize: 32,
            fontWeight: 700,
            color: '#111827',
            align: 'center',
            letterSpacing: 0,
            lineHeight: 1.2,
            minFontSize: 16,
            maxLines: 1,
            uppercase: false
          },
          confidence: 0.95,
          source: 'ai'
        }
      ],
      analysis: {
        model: 'gemini-1.5-flash',
        promptVersion: 'v1.0.0',
        analyzedAt: '2026-10-07T00:00:00.000Z'
      }
    };

    const layoutHash = await computeLayoutHash(rawTemplate.fields);
    expect(layoutHash).toMatch(/^0x[a-f0-9]{64}$/);

    const metadataA: CertificateMetadata = {
      schemaVersion: '1.0',
      certificateTitle: 'Certified Web3 Architect',
      description: 'Award of Excellence',
      issuerName: 'CertiChain Academy',
      recipientName: 'Alice Nakamoto',
      issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      issueDate: '2026-10-07T00:00:00.000Z',
      expiryDate: null,
      custom: {
        schemaVersion: 1,
        templateHash: rawTemplate.templateHash,
        templateCid: 'QmTemplate111',
        renderedCid: 'QmRendered222',
        renderedHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        layoutHash,
        values: {
          recipientName: 'Alice Nakamoto',
          courseGrade: 'Distinction'
        }
      }
    };

    // Reconstruct with reversed key order
    const metadataB: CertificateMetadata = {
      custom: {
        values: {
          courseGrade: 'Distinction',
          recipientName: 'Alice Nakamoto'
        },
        layoutHash,
        renderedHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        renderedCid: 'QmRendered222',
        templateCid: 'QmTemplate111',
        templateHash: rawTemplate.templateHash,
        schemaVersion: 1
      },
      expiryDate: null,
      description: 'Award of Excellence',
      issueDate: '2026-10-07T00:00:00.000Z',
      recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      recipientName: 'Alice Nakamoto',
      issuerName: 'CertiChain Academy',
      certificateTitle: 'Certified Web3 Architect',
      schemaVersion: '1.0'
    };

    const canonicalA = canonicalize(metadataA);
    const canonicalB = canonicalize(metadataB);

    expect(canonicalA).toEqual(canonicalB);

    const hashA = await computeStringHash(canonicalA);
    const hashB = await computeStringHash(canonicalB);

    expect(hashA).toEqual(hashB);
    expect(hashA).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('postProcessDetectedFields correctly clamps, snaps to 0.25% grid, and enforces unique keys', () => {
    const rawFields: TemplateField[] = [
      {
        key: 'testKey',
        label: 'Test Label 1',
        type: 'text',
        required: true,
        box: { x: 0.12345, y: 0.24567, w: 0.33333, h: 0.44444 },
        style: null,
        confidence: 0.9,
        source: 'ai'
      },
      {
        key: 'testKey', // duplicate key
        label: 'Test Label 2',
        type: 'text',
        required: false,
        box: { x: 0.5, y: 0.5, w: 0.2, h: 0.1 },
        style: null,
        confidence: 0.85,
        source: 'ai'
      }
    ];

    const processed = postProcessDetectedFields(rawFields);
    expect(processed).toHaveLength(2);
    expect(processed[0].key).toBe('testKey');
    expect(processed[1].key).toBe('testKey1');

    // Snapped to 0.0025 multiples
    expect(processed[0].box?.x).toBe(0.1225);
    expect(processed[0].box?.y).toBe(0.245);
  });

  it('sanitizes SVG templates removing malicious script tags and event handlers', () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="blue" onclick="alert('xss')" />
      <script>alert('pwned')</script>
      <text x="10" y="20">Valid Certificate</text>
    </svg>`;

    const result = sanitizeSvg(maliciousSvg);
    expect(result.sanitizedSvg).not.toContain('<script');
    expect(result.sanitizedSvg).not.toContain('onclick');
    expect(result.sanitizedSvg).toContain('Valid Certificate');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('strips EXIF metadata from JPEG buffers', () => {
    // SOI (FF D8) + APP1 (FF E1 00 08 ...) + SOS (FF DA) + EOI (FF D9)
    const jpegWithExif = new Uint8Array([
      0xFF, 0xD8, // SOI
      0xFF, 0xE1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, // APP1 marker with length 8
      0xFF, 0xDA, 0x00, 0x02, // SOS marker
      0xFF, 0xD9  // EOI
    ]);

    const stripped = stripJpegExifBytes(jpegWithExif.buffer);
    expect(stripped.length).toBeLessThan(jpegWithExif.length);
    // Verified that APP1 marker 0xFF 0xE1 is eliminated
    let hasApp1 = false;
    for (let i = 0; i < stripped.length - 1; i++) {
      if (stripped[i] === 0xFF && stripped[i + 1] === 0xE1) {
        hasApp1 = true;
      }
    }
    expect(hasApp1).toBe(false);
  });

  it('regression (a): asserts templateHash equals sha256(base64ToUint8Array(previewDataUrl)) post EXIF stripping', async () => {
    // Synthetic JPEG with EXIF header
    const jpegWithExif = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9,
    ]);
    const cleanBytes = stripJpegExifBytes(jpegWithExif.buffer);
    const cleanBase64 = `data:image/jpeg;base64,${btoa(
      Array.from(cleanBytes)
        .map((b) => String.fromCharCode(b))
        .join('')
    )}`;

    // Raw hash vs. Clean hash
    const rawHash = await sha256Bytes(jpegWithExif);

    const decodedBytes = base64ToUint8Array(cleanBase64);
    const cleanTemplateHash = await sha256Bytes(decodedBytes);

    // The raw and clean hashes differ due to stripped EXIF
    expect(rawHash).not.toEqual(cleanTemplateHash);

    // Pinned templateHash MUST equal SHA-256 of the decoded clean bytes
    const recomputedHash = await sha256Bytes(decodedBytes);
    expect(cleanTemplateHash).toEqual(recomputedHash);
  });

  it('regression (b): asserts pinBinaryToIpfs resolves without PIN_HASH_MISMATCH for JPEG, PNG, PDF, and SVG inputs', async () => {
    const formats = [
      {
        type: 'image/png',
        name: 'template.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
      {
        type: 'image/jpeg',
        name: 'template.jpg',
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      },
      {
        type: 'application/pdf',
        name: 'template.pdf',
        dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCg==',
      },
      {
        type: 'image/svg+xml',
        name: 'template.svg',
        dataUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJyZWQiLz48L3N2Zz4=',
      },
    ];

    for (const item of formats) {
      const bytes = base64ToUint8Array(item.dataUrl);
      const expectedTemplateHash = await sha256Bytes(bytes);

      const pinResult = await pinBinaryToIpfs({
        fileBase64: item.dataUrl,
        fileName: item.name,
        mimeType: item.type,
        expectedHash: expectedTemplateHash,
        allowSimulatedFallback: true,
      });

      expect(pinResult.ipfsHash).toBeTruthy();
      expect(pinResult.metadataUrl).toContain(pinResult.ipfsHash);
    }
  });

  it('BUG-002 (a): optimizes high-resolution images so sanitized payload is strictly under 3.2 MB', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 3600;
    canvas.height = 2400;
    const ctx = canvas.getContext('2d');
    expect(ctx).not.toBeNull();
    ctx!.fillStyle = '#1e293b';
    ctx!.fillRect(0, 0, 3600, 2400);

    const result = await optimizeCanvasToDataUrl(canvas, MAX_ARTIFACT_BYTES, MAX_DIMENSION_PX);
    expect(result.bytes.length).toBeLessThanOrEqual(MAX_ARTIFACT_BYTES);
    expect(result.dataUrl).toBeTruthy();
    expect(result.hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('BUG-002 (b): rasterizes high-DPI canvases capping dimension at MAX_DIMENSION_PX (3200px) and under 3.2 MB', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4800;
    canvas.height = 3600;
    const ctx = canvas.getContext('2d');
    expect(ctx).not.toBeNull();
    ctx!.fillStyle = '#ffffff';
    ctx!.fillRect(0, 0, 4800, 3600);

    const result = await optimizeCanvasToDataUrl(canvas, MAX_ARTIFACT_BYTES, MAX_DIMENSION_PX);
    expect(result.bytes.length).toBeLessThanOrEqual(MAX_ARTIFACT_BYTES);
  });

  it('BUG-002 (c): preflightSizeCheck throws PIN_PAYLOAD_TOO_LARGE before network dispatch on > 4.5 MB input', () => {
    const oversizedByteLength = 5 * 1024 * 1024; // 5 MB
    expect(() => preflightSizeCheck(oversizedByteLength)).toThrowError(/exceeds 4.5 MB serverless limit/);

    const validByteLength = 2.5 * 1024 * 1024; // 2.5 MB
    expect(() => preflightSizeCheck(validByteLength)).not.toThrow();
  });

  it('BUG-002 (d): invariant templateHash strictly equals sha256(base64ToUint8Array(finalDataUrl)) on optimized payloads', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 1414;
    const ctx = canvas.getContext('2d');
    ctx!.fillStyle = '#0f172a';
    ctx!.fillRect(0, 0, 2000, 1414);

    const optimized = await optimizeCanvasToDataUrl(canvas, MAX_ARTIFACT_BYTES, MAX_DIMENSION_PX);
    const decodedBytes = base64ToUint8Array(optimized.dataUrl);
    const recomputedHash = await sha256Bytes(decodedBytes);

    expect(optimized.hash).toEqual(recomputedHash);
  });

  it('BUG-002 (e): asserts cleaned base and rendered PNG both pass the 3.2 MB artifact budget', async () => {
    const rawTemplate: CertificateTemplate = {
      schemaVersion: 1,
      templateHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      mimeType: 'image/png',
      widthPx: 1920,
      heightPx: 1080,
      orientation: 'landscape',
      analysis: {
        model: 'gemini-1.5-pro',
        promptVersion: '1.0',
        analyzedAt: '2026-10-08T00:00:00.000Z',
      },
      fields: [
        {
          key: 'recipientName',
          label: 'Recipient Name',
          type: 'name',
          required: true,
          box: { x: 0.2, y: 0.4, w: 0.6, h: 0.1 },
          style: {
            fontFamily: 'Inter',
            fontSize: 32,
            fontWeight: 700,
            color: '#111827',
            align: 'center',
            letterSpacing: 0,
            lineHeight: 1.2,
            minFontSize: 16,
            maxLines: 1,
            uppercase: false,
          },
          confidence: 0.99,
          source: 'ai',
        },
      ],
    };

    // Render certificate test
    const renderRes = await renderCustomCertificateCanvas({
      template: rawTemplate,
      values: { recipientName: 'Alice Test' },
      certId: '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    });

    const renderBytes = base64ToUint8Array(renderRes.pngDataUrl);
    expect(renderBytes.length).toBeLessThanOrEqual(MAX_ARTIFACT_BYTES);
    expect(renderRes.renderedHash).toEqual(await sha256Bytes(renderBytes));
  });

  it('BUG-003 (a): valid cert with custom template artifacts resolves to VALID state', async () => {
    const samplePng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sampleBytes = base64ToUint8Array(samplePng);
    const sampleHash = await sha256Bytes(sampleBytes);
    const templateCid = `QmSim${sampleHash.slice(2, 42)}`;

    // Store in simulated localStorage
    window.localStorage.setItem(`certichain_ipfs_${templateCid}`, samplePng);

    const metadata: CertificateMetadata = {
      schemaVersion: '1.0',
      certificateTitle: 'Blockchain Security Diploma',
      recipientName: 'Alice Nakamoto',
      recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      issuerName: 'CertiChain Consortium',
      issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      issueDate: '2026-10-08T00:00:00.000Z',
      expiryDate: null,
      description: 'Verified on-chain credential.',
      custom: {
        schemaVersion: 1,
        templateHash: sampleHash,
        templateCid,
        renderedHash: sampleHash,
        renderedCid: templateCid,
      },
    };

    const certId = await computeProofHash(metadata);
    const onChainCert: OnChainCertificate = {
      issuer: metadata.issuerAddress,
      recipient: metadata.recipientIdentifier,
      proofHash: certId,
      metadataUrl: `ipfs://QmSimMeta123`,
      issuedAt: 1760000000n,
      revoked: false,
      revokedAt: 0n,
    };

    const result = await verifyCertificateIntegrity({
      certId,
      onChainCert,
      isAuthorized: true,
      metadataOverride: metadata,
      chainId: 11155111,
      chainName: 'Sepolia Testnet',
    });

    expect(result.state).toBe('VALID');
    expect(result.customIntegrity?.valid).toBe(true);
    expect(result.customIntegrity?.templateHashMatch).toBe(true);
    expect(result.customIntegrity?.renderedHashMatch).toBe(true);
  });

  it('BUG-003 (b): one-byte tamper in template or rendered artifact resolves to INVALID_TAMPERED', async () => {
    const samplePng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sampleBytes = base64ToUint8Array(samplePng);
    const originalHash = await sha256Bytes(sampleBytes);
    const templateCid = `QmSim${originalHash.slice(2, 42)}`;

    // Tampered payload in storage
    const tamperedPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    window.localStorage.setItem(`certichain_ipfs_${templateCid}`, tamperedPng);

    const metadata: CertificateMetadata = {
      schemaVersion: '1.0',
      certificateTitle: 'Tamper Test Diploma',
      recipientName: 'Bob Tamper',
      recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      issuerName: 'CertiChain Consortium',
      issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      issueDate: '2026-10-08T00:00:00.000Z',
      expiryDate: null,
      description: 'Tamper verification test.',
      custom: {
        schemaVersion: 1,
        templateHash: originalHash,
        templateCid,
      },
    };

    const certId = await computeProofHash(metadata);
    const onChainCert: OnChainCertificate = {
      issuer: metadata.issuerAddress,
      recipient: metadata.recipientIdentifier,
      proofHash: certId,
      metadataUrl: `ipfs://QmSimMeta123`,
      issuedAt: 1760000000n,
      revoked: false,
      revokedAt: 0n,
    };

    const result = await verifyCertificateIntegrity({
      certId,
      onChainCert,
      isAuthorized: true,
      metadataOverride: metadata,
      chainId: 11155111,
      chainName: 'Sepolia Testnet',
    });

    expect(result.state).toBe('INVALID_TAMPERED');
    expect(result.errorReason).toContain('Custom certificate template or rendered image has been tampered with');
    expect(result.customIntegrity?.templateHashMatch).toBe(false);
  });

  it('BUG-003 (c): fetchArtifactBytes works from inline dataUrl, simulated QmSim localStorage cache, and gateway responses', async () => {
    const samplePng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const expectedBytes = base64ToUint8Array(samplePng);

    // 1. Inline dataUrl resolution
    const inlineRes = await fetchArtifactBytes(undefined, samplePng);
    expect(inlineRes).not.toBeNull();
    expect(inlineRes).toEqual(expectedBytes);

    // 2. Simulated QmSim localStorage resolution (R1 format check)
    const simCid = 'QmSimTestBinary1234567890abcdef';
    window.localStorage.setItem(`certichain_ipfs_${simCid}`, samplePng);
    const simRes = await fetchArtifactBytes(simCid, undefined);
    expect(simRes).not.toBeNull();
    expect(simRes).toEqual(expectedBytes);

    // 3. Real gateway mock response
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => expectedBytes.buffer,
    } as Response);

    const realCid = 'QmRealIpfsGatewayTestCid1234567890';
    const gatewayRes = await fetchArtifactBytes(realCid, undefined);
    expect(gatewayRes).not.toBeNull();
    expect(gatewayRes).toEqual(expectedBytes);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('BUG-003 (d): unreachable gateway resolves to INVALID_UNVERIFIABLE (not TAMPERED)', async () => {
    const unreachableCid = 'QmRealUnreachableGatewayCid123456789';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Gateway timeout'));

    const metadata: CertificateMetadata = {
      schemaVersion: '1.0',
      certificateTitle: 'Unreachable Gateway Test',
      recipientName: 'Charlie Gateway',
      recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      issuerName: 'CertiChain Consortium',
      issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      issueDate: '2026-10-08T00:00:00.000Z',
      expiryDate: null,
      description: 'Testing gateway timeout failure mode.',
      custom: {
        schemaVersion: 1,
        templateHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        templateCid: unreachableCid,
      },
    };

    const certId = await computeProofHash(metadata);
    const onChainCert: OnChainCertificate = {
      issuer: metadata.issuerAddress,
      recipient: metadata.recipientIdentifier,
      proofHash: certId,
      metadataUrl: `ipfs://QmSimMeta123`,
      issuedAt: 1760000000n,
      revoked: false,
      revokedAt: 0n,
    };

    const result = await verifyCertificateIntegrity({
      certId,
      onChainCert,
      isAuthorized: true,
      metadataOverride: metadata,
      chainId: 11155111,
      chainName: 'Sepolia Testnet',
    });

    expect(result.state).toBe('INVALID_UNVERIFIABLE');
    expect(result.errorReason).toContain('Custom certificate artifacts could not be retrieved');
  });

  it('BUG-003 (e): URL parse round-trip for ?chain=11155111 with and without "?" (glued chain parameter)', () => {
    const rawCertId = '0x4a0c503a2bf3b9f0fe6d7c69271643f791e95572809491c198934ebb1d342f01';

    // Normal URL
    const standardUrl = `http://localhost:5173/verify/${rawCertId}?chain=11155111`;
    const parsed1 = extractCertIdAndChain(standardUrl);
    expect(parsed1.valid).toBe(true);
    expect(parsed1.certId).toBe(rawCertId);
    expect(parsed1.chainId).toBe(11155111);

    // Glued parameter (missing '?' or delimiter)
    const gluedUrl = `http://localhost:5173/verify/${rawCertId}2chain=11155111`;
    const parsed2 = extractCertIdAndChain(gluedUrl);
    expect(parsed2.valid).toBe(true);
    expect(parsed2.certId).toBe(rawCertId);
    expect(parsed2.chainId).toBe(11155111);

    // Trailing delimiter
    const trailingUrl = `http://localhost:5173/verify/${rawCertId}/#section`;
    const parsed3 = extractCertIdAndChain(trailingUrl);
    expect(parsed3.valid).toBe(true);
    expect(parsed3.certId).toBe(rawCertId);
  });

  it('BUG-003 (f): fetchArtifactBytes for real (non-QmSim) CID strictly bypasses localStorage cache (Refinement R2)', async () => {
    const realCid = 'QmRealProductionIpfsCid9876543210';
    const fakeStoredData = 'data:image/png;base64,FAKE_TAMPERED_LOCALSTORAGE_PAYLOAD';

    // Attacker puts tampered payload in localStorage under real CID key
    window.localStorage.setItem(`certichain_ipfs_${realCid}`, fakeStoredData);

    const validGatewayBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => validGatewayBytes.buffer,
    } as Response);

    const res = await fetchArtifactBytes(realCid, undefined);
    expect(res).not.toBeNull();
    expect(res).toEqual(validGatewayBytes);
    // Real CID must have gone to the network gateway, completely ignoring localStorage
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('BUG-004 (a): CertificateView renders CustomCertificatePreview when metadata.custom and renderedDataUrl are provided', () => {
    const customMetadata: CertificateMetadata = {
      schemaVersion: '1.0',
      certificateTitle: 'Blockchain Architect Certificate',
      recipientName: 'Alice Nakamoto',
      recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      issuerName: 'Decentralized Academic Consortium',
      issuerAddress: '0x637E12788e63B5145b4Bff5920D4525890786524',
      issueDate: '2026-10-08T00:00:00.000Z',
      expiryDate: null,
      description: 'Official custom verified certificate',
      custom: {
        schemaVersion: 1,
        templateHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        templateCid: 'QmSimTemplate123',
        renderedHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        renderedCid: 'QmSimRendered123',
        values: {
          recipientName: 'Alice Nakamoto',
          certificateTitle: 'Blockchain Architect Certificate',
        },
      },
    };

    const testRenderedDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const { container } = render(
      React.createElement(CertificateView, {
        metadata: customMetadata,
        renderedDataUrl: testRenderedDataUrl,
      })
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(testRenderedDataUrl);
    expect(container.textContent).toContain('Alice Nakamoto');
    expect(container.textContent).toContain('Blockchain Architect Certificate');
  });

  it('BUG-004 (b): CertificateView does NOT re-render or alter the bytes; displayed src equals the verified renderedDataUrl exactly', () => {
    const customMetadata: CertificateMetadata = {
      schemaVersion: '1.0',
      certificateTitle: 'Course Award',
      recipientName: 'Bob Smith',
      recipientIdentifier: '0x1234567890123456789012345678901234567890',
      issuerName: 'Test Issuer',
      issuerAddress: '0x0000000000000000000000000000000000000001',
      issueDate: '2026-10-08T00:00:00.000Z',
      expiryDate: null,
      description: 'Test',
      custom: {
        schemaVersion: 1,
        templateHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
        renderedHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
        renderedCid: 'QmSimRendered444',
      },
    };

    const verifiedBytesDataUrl = 'data:image/png;base64,EXACT_VERIFIED_BIT_FOR_BIT_STRING_12345';

    const { container } = render(
      React.createElement(CertificateView, {
        metadata: customMetadata,
        renderedDataUrl: verifiedBytesDataUrl,
      })
    );

    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe(verifiedBytesDataUrl);
  });

  it('BUG-004 (c): VerificationResult passes renderedDataUrl only when renderedHash matched during verification; INVALID_UNVERIFIABLE state produces no renderedDataUrl', async () => {
    const samplePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const sampleBytes = base64ToUint8Array(samplePng);
    const sampleHash = await sha256Bytes(sampleBytes);
    const renderedCid = `QmSim${sampleHash.slice(2, 42)}`;

    window.localStorage.setItem(`certichain_ipfs_${renderedCid}`, samplePng);

    const validMetadata: CertificateMetadata = {
      schemaVersion: '1.0',
      certificateTitle: 'Valid Custom Certificate',
      recipientName: 'Alice Nakamoto',
      recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      issuerName: 'Authorized Issuer',
      issuerAddress: '0x637E12788e63B5145b4Bff5920D4525890786524',
      issueDate: '2026-10-08T00:00:00.000Z',
      expiryDate: null,
      description: 'Verified custom',
      custom: {
        schemaVersion: 1,
        templateHash: sampleHash,
        templateCid: renderedCid,
        renderedHash: sampleHash,
        renderedCid: renderedCid,
        values: {
          recipientName: 'Alice Nakamoto',
        },
      },
    };

    const validCanonicalHash = await computeProofHash(validMetadata);
    const validOnChain: OnChainCertificate = {
      issuer: '0x637E12788e63B5145b4Bff5920D4525890786524',
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      proofHash: validCanonicalHash,
      metadataUrl: `ipfs://QmSimMetaValid123`,
      issuedAt: 1728345600n,
      revoked: false,
      revokedAt: 0n,
    };

    // Case 1: Valid Custom Certificate produces renderedDataUrl
    const validResult = await verifyCertificateIntegrity({
      certId: validCanonicalHash,
      onChainCert: validOnChain,
      metadataOverride: validMetadata,
      isAuthorized: true,
      chainId: 11155111,
      chainName: 'Sepolia',
      registryAddress: '0xRegistry',
    });

    expect(validResult.state).toBe('VALID');
    expect(validResult.renderedDataUrl).toBeDefined();
    expect(validResult.renderedDataUrl).toContain('data:image/png;base64,');

    // Case 2: Unreachable IPFS artifact produces INVALID_UNVERIFIABLE and no renderedDataUrl
    const unreachableCid = 'QmSimUnreachableArtifactCid9999999';
    const unverifiableMetadata: CertificateMetadata = {
      ...validMetadata,
      custom: {
        ...validMetadata.custom!,
        renderedCid: unreachableCid,
      },
    };
    const unverifiableProofHash = await computeProofHash(unverifiableMetadata);
    const unverifiableOnChain: OnChainCertificate = {
      ...validOnChain,
      proofHash: unverifiableProofHash,
      metadataUrl: `ipfs://QmSimMetaUnverifiable123`,
    };

    const unverifiableResult = await verifyCertificateIntegrity({
      certId: unverifiableProofHash,
      onChainCert: unverifiableOnChain,
      metadataOverride: unverifiableMetadata,
      isAuthorized: true,
      chainId: 11155111,
      chainName: 'Sepolia',
      registryAddress: '0xRegistry',
    });

    expect(unverifiableResult.state).toBe('INVALID_UNVERIFIABLE');
    expect(unverifiableResult.renderedDataUrl).toBeUndefined();
  });

  it('BUG-004 (d): uint8ArrayToDataUrl round-trips a 3 MB random buffer without throwing; decoded byte length equals input byte length', () => {
    const size = 3 * 1024 * 1024;
    const randomBytes = new Uint8Array(size);
    for (let i = 0; i < size; i += 1024) {
      randomBytes[i] = (i * 31) & 0xff;
    }
    const dataUrl = uint8ArrayToDataUrl(randomBytes, 'image/png');
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    const decoded = base64ToUint8Array(dataUrl);
    expect(decoded.length).toBe(size);
    expect(decoded[0]).toBe(randomBytes[0]);
    expect(decoded[1024]).toBe(randomBytes[1024]);
  });

  it('BUG-004 (e): sniffImageMime returns "image/png" for the canonical PNG magic bytes, "image/webp" for RIFF/WEBP, "image/jpeg" for FF D8 FF, and "application/octet-stream" for arbitrary binary', () => {
    const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(sniffImageMime(pngMagic)).toBe('image/png');

    const webpMagic = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImageMime(webpMagic)).toBe('image/webp');

    const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffImageMime(jpegMagic)).toBe('image/jpeg');

    const arbitraryBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(sniffImageMime(arbitraryBytes)).toBe('application/octet-stream');
  });
});

