/**
 * @file canonicalize.ts
 * @summary Single Responsibility: Deterministically serializes JSON objects into RFC 8785 (JCS) canonical format.
 *
 * Rules:
 * 1. Recursively sorts object keys by UTF-16 code unit order.
 * 2. Excludes `issuedProofHash` field from hash calculation (Decision 2.8).
 * 3. Preserves array element order.
 * 4. Eliminates insignificant whitespace.
 * 5. Serializes numbers via standard ECMAScript Number.prototype.toString().
 */

export function canonicalize(val: unknown): string {
  if (val === null) {
    return 'null';
  }

  if (typeof val === 'boolean' || typeof val === 'number') {
    return val.toString();
  }

  if (typeof val === 'string') {
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    const items = val.map((item) => canonicalize(item));
    return `[${items.join(',')}]`;
  }

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    // UTF-16 code unit order key sort
    const sortedKeys = Object.keys(obj)
      .filter((k) => k !== 'issuedProofHash') // Excluded per Decision 2.8
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const entries = sortedKeys
      .filter((key) => obj[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(val);
}
