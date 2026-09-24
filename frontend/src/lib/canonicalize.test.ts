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
});
