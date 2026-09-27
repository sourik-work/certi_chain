/**
 * @file canonicalize.ts
 * @summary Deterministically serializes JSON objects into RFC 8785 (JSON Canonicalization Scheme - JCS) format.
 *
 * Why Canonicalization is Essential in CertiChain:
 * In JSON, two objects with the same key-value pairs but different key order or whitespace
 * (e.g. `{"a":1,"b":2}` vs `{"b": 2, "a": 1}`) produce different SHA-256 hashes.
 * Canonicalization normalizes the structure into an unambiguous, bit-for-bit identical byte representation.
 *
 * Rules Implemented:
 * 1. Recursively sorts dictionary keys in lexicographical UTF-16 code unit order.
 * 2. Excludes the `issuedProofHash` field from hash calculation (avoids circular hashing dependency).
 * 3. Preserves exact array item order.
 * 4. Eliminates all non-essential whitespace characters.
 * 5. Converts numbers using standard ECMAScript toString() specifications.
 */

/**
 * Transforms an arbitrary JSON value or nested object into its canonicalized string representation.
 * @param val - The raw object, array, string, number, boolean, or null to canonicalize.
 * @returns The canonicalized string.
 */
export function canonicalize(val: unknown): string {
  // Rule 1: Primitive null handling
  if (val === null) {
    return 'null';
  }

  // Rule 2: Booleans and Numbers serialized directly
  if (typeof val === 'boolean' || typeof val === 'number') {
    return val.toString();
  }

  // Rule 3: Strings serialized with standard JSON escaping
  if (typeof val === 'string') {
    return JSON.stringify(val);
  }

  // Rule 4: Arrays maintain deterministic order of elements
  if (Array.isArray(val)) {
    const items = val.map((item) => canonicalize(item));
    return `[${items.join(',')}]`;
  }

  // Rule 5: Objects sort keys in UTF-16 lexicographical order and exclude self-referencing hashes
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    
    // Extract and sort object keys alphabetically
    const sortedKeys = Object.keys(obj)
      .filter((k) => k !== 'issuedProofHash') // Excluded per design decision to prevent circular hash loops
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    // Recursively canonicalize each property entry
    const entries = sortedKeys
      .filter((key) => obj[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`);

    return `{${entries.join(',')}}`;
  }

  // Fallback for any other unexpected primitive type
  return JSON.stringify(val);
}

