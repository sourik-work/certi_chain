import { describe, it, expect } from 'vitest';
import { validateAndSanitizeMetadata, sanitizeString } from './validateMetadata';

describe('validateAndSanitizeMetadata', () => {
  const validMetadata = {
    schemaVersion: '1.0',
    certificateTitle: 'Certified Fullstack Engineer',
    recipientName: 'Bob Builder',
    recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    issuerName: 'Tech University',
    issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    issueDate: '2026-09-24T12:00:00.000Z',
    expiryDate: null,
    description: 'Completion of 500-hour comprehensive curriculum.',
    additionalFields: { GPA: '3.9' },
  };

  it('validates a correct metadata object', () => {
    const result = validateAndSanitizeMetadata(validMetadata);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.sanitizedData?.certificateTitle).toBe('Certified Fullstack Engineer');
  });

  it('rejects missing or invalid schemaVersion', () => {
    const result = validateAndSanitizeMetadata({ ...validMetadata, schemaVersion: '2.0' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('schemaVersion'))).toBe(true);
  });

  it('rejects missing recipientName or title', () => {
    const result = validateAndSanitizeMetadata({ ...validMetadata, recipientName: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Recipient name'))).toBe(true);
  });

  it('rejects invalid issuer Ethereum address', () => {
    const result = validateAndSanitizeMetadata({ ...validMetadata, issuerAddress: '0xinvalid' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Ethereum address'))).toBe(true);
  });

  it('sanitizes XSS injection payload in fields', () => {
    const malicious = {
      ...validMetadata,
      recipientName: 'Bob <script>alert("XSS")</script>',
      description: '<img src=x onerror=alert(1)>Malicious description',
    };

    const result = validateAndSanitizeMetadata(malicious);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData?.recipientName).toBe('Bob');
    expect(result.sanitizedData?.description).not.toContain('<img');
    expect(result.sanitizedData?.description).not.toContain('onerror');
  });

  it('sanitizeString removes dangerous tags cleanly', () => {
    expect(sanitizeString('Hello <script>dangerous()</script>World')).toBe('Hello World');
    expect(sanitizeString('Test<b>Bold</b>')).toBe('TestBold');
  });

  it('validates additive template and templateValues correctly', () => {
    const withTemplate = {
      ...validMetadata,
      template: {
        schema: 'certichain.template/v1',
        cid: 'QmTestTemplateCid123456789',
        sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
        name: 'Executive Design',
      },
      templateValues: {
        recipient_name: 'Bob Builder',
        grade: 'Distinction',
      },
    };

    const result = validateAndSanitizeMetadata(withTemplate);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData?.template?.cid).toBe('QmTestTemplateCid123456789');
    expect(result.sanitizedData?.templateValues?.grade).toBe('Distinction');
  });

  it('rejects malformed template sha256 hash', () => {
    const badHash = {
      ...validMetadata,
      template: {
        schema: 'certichain.template/v1',
        cid: 'QmTest',
        sha256: 'not-a-64-char-hex',
        name: 'Bad Hash Template',
      },
    };

    const result = validateAndSanitizeMetadata(badHash);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('64-character hex string'))).toBe(true);
  });

  it('validates and sanitizes custom certificate blocks', () => {
    const customValid = {
      ...validMetadata,
      custom: {
        schemaVersion: 1,
        templateHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        templateCid: 'QmTemplate123',
        renderedCid: 'QmRendered456',
        renderedHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        layoutHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
        values: {
          recipientName: 'Alice Nakamoto <script>alert(1)</script>',
          courseTitle: 'Blockchain Architect',
        },
      },
    };

    const result = validateAndSanitizeMetadata(customValid);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData?.custom?.schemaVersion).toBe(1);
    expect(result.sanitizedData?.custom?.templateCid).toBe('QmTemplate123');
    expect(result.sanitizedData?.custom?.values?.recipientName).toBe('Alice Nakamoto');
  });

  it('rejects custom block with missing templateHash or invalid schemaVersion', () => {
    const invalidCustom = {
      ...validMetadata,
      custom: {
        schemaVersion: 2,
        // missing templateHash
      },
    };

    const result = validateAndSanitizeMetadata(invalidCustom);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('schemaVersion'))).toBe(true);
    expect(result.errors.some((e) => e.includes('templateHash'))).toBe(true);
  });
});
