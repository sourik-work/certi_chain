import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SAMPLE_TEMPLATE_SPEC } from '../lib/template/sampleSpec';
import { validateAndSanitizeMetadata } from '../lib/validateMetadata';
import { computeProofHash } from '../lib/hash';
import { pinMetadataToIpfs } from '../lib/pinata';
import { pinTemplateToIpfs } from '../lib/template/pin';
import { verifyCertificateIntegrity } from '../lib/verify';
import { CertificateView } from '../components/CertificateView';
import { extractFieldsFromOcrLines, OcrLine } from '../lib/template/ocr';
import { mapOcrVariablesToFigmaLayers } from '../lib/template/figma';
import { CertificateMetadata } from '../types/certificate';

describe('End-to-End Template Pipeline Integration', () => {
  it('issues with Values A, verifies, and renders Values A without falling back to sample', async () => {
    const valuesA: Record<string, string> = {
      certificate_number: 'CERT-A-1001',
      certificate_type: 'EXCELLENCE',
      recipient_name: 'Alice Nakamoto',
      role_verb: 'participated',
      event_name: 'Zero Knowledge Cryptography Deep Dive',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
    };

    // 1. Pin Template
    const tplPin = await pinTemplateToIpfs(SAMPLE_TEMPLATE_SPEC);
    expect(tplPin.cid).toBeDefined();

    // 2. Build metadata
    const rawMetadata: CertificateMetadata = {
      schemaVersion: '1.0',
      certificateTitle: 'Zero Knowledge Cryptography Deep Dive',
      recipientName: valuesA.recipient_name,
      recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      issuerName: 'Consortium of Cryptography',
      issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      issueDate: new Date('2026-08-01').toISOString(),
      expiryDate: null,
      description: valuesA.event_name,
      template: {
        schema: 'certichain.template/v1',
        cid: tplPin.cid,
        sha256: tplPin.sha256,
        name: SAMPLE_TEMPLATE_SPEC.name,
      },
      templateValues: valuesA,
    };

    const valResult = validateAndSanitizeMetadata(rawMetadata);
    expect(valResult.isValid).toBe(true);
    const finalMetadata = valResult.sanitizedData!;
    expect(finalMetadata.templateValues?.recipient_name).toBe('Alice Nakamoto');

    // 3. Compute hash and pin metadata
    const proofHash = await computeProofHash(finalMetadata);
    const metaPin = await pinMetadataToIpfs({ ...finalMetadata, issuedProofHash: proofHash });

    // 4. Verify certificate integrity
    const verifyResult = await verifyCertificateIntegrity({
      certId: proofHash,
      onChainCert: {
        proofHash,
        metadataUrl: metaPin.metadataUrl,
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        issuedAt: 1722470400n,
        revokedAt: 0n,
        revoked: false,
      },
      isAuthorized: true,
      metadataOverride: finalMetadata,
      templateOverride: SAMPLE_TEMPLATE_SPEC,
    });

    expect(verifyResult.state).toBe('VALID');
    expect(verifyResult.metadata?.templateValues?.recipient_name).toBe('Alice Nakamoto');

    // 5. Render CertificateView from verification result
    render(
      <CertificateView
        metadata={verifyResult.metadata!}
        templateSpec={verifyResult.templateSpec}
        templateValues={verifyResult.metadata?.templateValues}
        proofHash={verifyResult.certId}
        certId={verifyResult.certId}
      />
    );

    expect(screen.getByText('Alice Nakamoto')).toBeDefined();
    expect(screen.getByText('EXCELLENCE')).toBeDefined();
    expect(screen.getByText(/Zero Knowledge Cryptography Deep Dive/)).toBeDefined();
    expect(screen.queryByText('MR. SOUMALYA MUKHERJEE')).toBeNull();
  });

  it('generates two distinct CIDs for two distinct metadata payloads', async () => {
    const meta1: CertificateMetadata = {
      schemaVersion: '1.0',
      certificateTitle: 'Title 1',
      recipientName: 'Recipient 1',
      recipientIdentifier: 'rec1@test.com',
      issuerName: 'Issuer',
      issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      issueDate: '2026-01-01T00:00:00.000Z',
      expiryDate: null,
      description: 'Desc 1',
    };

    const meta2: CertificateMetadata = {
      ...meta1,
      recipientName: 'Recipient 2',
      description: 'Desc 2',
    };

    const pin1 = await pinMetadataToIpfs(meta1);
    const pin2 = await pinMetadataToIpfs(meta2);

    expect(pin1.ipfsHash).not.toBe(pin2.ipfsHash);
  });

  it('runs OCR extraction on alternative certificate wording without hardcoded dependencies', () => {
    const genericLines: OcrLine[] = [
      {
        id: 'line_1',
        text: 'Certificate ID: CERT-GEN-999',
        bbox: { x0: 100, y0: 200, x1: 500, y1: 240 },
        words: [],
      },
      {
        id: 'line_2',
        text: 'OF COMPLETION',
        bbox: { x0: 400, y0: 300, x1: 900, y1: 350 },
        words: [],
      },
      {
        id: 'line_3',
        text: 'This certificate is proudly presented to JANE DOE for completing the AI Masterclass on March 15th, 2026',
        bbox: { x0: 200, y0: 450, x1: 1200, y1: 550 },
        words: [],
      },
    ];

    const result = extractFieldsFromOcrLines(genericLines, 1600, 1000);
    expect(result.blocks.length).toBeGreaterThanOrEqual(3);
    expect(result.fields.some((f) => f.key === 'recipient_name')).toBe(true);
    expect(result.fields.some((f) => f.key === 'certificate_number')).toBe(true);
  });

  it('verifies upload-to-Figma prompt flow mapping OCR variables to imported Figma frame', async () => {
    const ocrFields = [
      {
        key: 'recipient_name',
        label: 'Recipient Name',
        type: 'text' as const,
        required: true,
        sample: 'Jane Doe',
        mapsTo: 'recipient_name' as const,
      },
      {
        key: 'event_name',
        label: 'Event Title',
        type: 'text' as const,
        required: true,
        sample: 'AI Masterclass',
        mapsTo: 'credential_title' as const,
      },
    ];

    const ocrBlocks = [
      {
        id: 'blk_ocr_1',
        rect: { x: 200, y: 450, w: 1000, h: 60 },
        text: 'This certificate is proudly presented to {{recipient_name}} for completing {{event_name}}',
        style: SAMPLE_TEMPLATE_SPEC.blocks[0].style,
        role: 'paragraph' as const,
      },
    ];

    const figmaBaseSpec = {
      ...SAMPLE_TEMPLATE_SPEC,
      id: 'tpl_figma_test',
      name: 'Figma Verified Template',
      blocks: [
        {
          id: 'blk_figma_recipient_name',
          rect: { x: 210, y: 460, w: 980, h: 55 },
          text: 'Student Name Placeholder',
          style: {
            fontFamily: 'Inter',
            fontWeight: 700 as const,
            fontSize: 36,
            color: '#1E293B',
            align: 'center' as const,
            lineHeight: 1.2,
            letterSpacing: 0,
            transform: 'none' as const,
            fit: 'shrink' as const,
            maxLines: 2,
          },
          role: 'fixed' as const,
        },
      ],
      fields: [],
    };

    const syncedSpec = mapOcrVariablesToFigmaLayers(ocrFields, ocrBlocks, figmaBaseSpec);

    expect(syncedSpec.fields.length).toBe(2);
    expect(syncedSpec.fields.some((f) => f.key === 'recipient_name')).toBe(true);
    expect(syncedSpec.blocks.some((b) => b.text.includes('{{recipient_name}}'))).toBe(true);
    expect(syncedSpec.figma?.fileKey).toBeDefined();
  });
});
