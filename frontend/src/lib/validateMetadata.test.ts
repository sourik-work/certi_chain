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
});
