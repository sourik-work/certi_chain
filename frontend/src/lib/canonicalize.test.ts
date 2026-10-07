import { describe, it, expect } from 'vitest';
import { canonicalize } from './canonicalize';

describe('canonicalize', () => {
  it('serializes primitives correctly', () => {
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(false)).toBe('false');
    expect(canonicalize(42)).toBe('42');
    expect(canonicalize('hello world')).toBe('"hello world"');
  });

  it('sorts object keys alphabetically regardless of insertion order', () => {
    const objA = { z: 1, a: 2, m: 3 };
    const objB = { a: 2, m: 3, z: 1 };
    const objC = { m: 3, z: 1, a: 2 };

    const canonical = '{"a":2,"m":3,"z":1}';
    expect(canonicalize(objA)).toBe(canonical);
    expect(canonicalize(objB)).toBe(canonical);
    expect(canonicalize(objC)).toBe(canonical);
  });

  it('recursively sorts nested objects', () => {
    const nestedA = { b: { y: 1, x: 2 }, a: 10 };
    const nestedB = { a: 10, b: { x: 2, y: 1 } };

    const expected = '{"a":10,"b":{"x":2,"y":1}}';
    expect(canonicalize(nestedA)).toBe(expected);
    expect(canonicalize(nestedB)).toBe(expected);
  });

  it('preserves array order without sorting', () => {
    const objWithArray = { items: [3, 1, 2], name: 'test' };
    expect(canonicalize(objWithArray)).toBe('{"items":[3,1,2],"name":"test"}');
  });

  it('strictly excludes issuedProofHash from canonical output (Decision 2.8)', () => {
    const payloadWithHash = {
      schemaVersion: '1.0',
      certificateTitle: 'Degree',
      issuedProofHash: '0xabcdef123456',
    };

    const payloadWithoutHash = {
      schemaVersion: '1.0',
      certificateTitle: 'Degree',
    };

    expect(canonicalize(payloadWithHash)).toBe(canonicalize(payloadWithoutHash));
    expect(canonicalize(payloadWithHash)).not.toContain('issuedProofHash');
  });

  it('handles non-ASCII characters (Devanagari, Emoji, Chinese, Japanese, Accents) identically across permutations', () => {
    const unicodeObj1 = {
      recipientName: 'आनंद शर्मा 🌟',
      certificateTitle: 'ब्लॉकचेन आर्किटेक्चर & AI 🎓',
      custom: {
        schemaVersion: 1,
        templateHash: '0x1234567890abcdef',
        values: {
          recipientName: 'आनंद शर्मा 🌟',
          city: 'मुंबई 🇮🇳',
          award: '荣誉证书 🏆',
        },
      },
    };

    const unicodeObj2 = {
      custom: {
        values: {
          award: '荣誉证书 🏆',
          city: 'मुंबई 🇮🇳',
          recipientName: 'आनंद शर्मा 🌟',
        },
        templateHash: '0x1234567890abcdef',
        schemaVersion: 1,
      },
      certificateTitle: 'ब्लॉकचेन आर्किटेक्चर & AI 🎓',
      recipientName: 'आनंद शर्मा 🌟',
    };

    expect(canonicalize(unicodeObj1)).toBe(canonicalize(unicodeObj2));
  });

  it('correctly serializes full custom certificate metadata structures', () => {
    const metadata = {
      schemaVersion: '1.0',
      certificateTitle: 'Certified Blockchain Architect',
      recipientName: 'Alice Nakamoto',
      recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      issuerName: 'Decentralized Academic Registry',
      issuerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      issueDate: '2026-10-01T00:00:00.000Z',
      expiryDate: null,
      description: 'Mastery in ZK and Smart Contract Security',
      custom: {
        schemaVersion: 1,
        templateHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        templateCid: 'QmTemplateCid123',
        renderedCid: 'QmRenderedCid456',
        renderedHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        layoutHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        values: {
          recipientName: 'Alice Nakamoto',
          courseTitle: 'Master in Smart Contract Architecture',
        },
      },
    };

    const result = canonicalize(metadata);
    expect(result).toContain('"custom":{"layoutHash":');
    expect(result).toContain('"renderedCid":"QmRenderedCid456"');
  });
});
