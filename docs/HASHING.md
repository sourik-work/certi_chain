# CertiChain Ledger — Canonicalization & Cryptographic Proof Hashing

This document details the canonicalization and hashing algorithm used by CertiChain Ledger. Any independent third party can reproduce the exact on-chain `proofHash` from the pinned IPFS metadata JSON alone by following this specification.

---

## 1. Overview & Principles

1. **Deterministic Representation (RFC 8785 / JCS standard)**: Object key order in arbitrary JSON serializations can vary across platforms and parsers. The canonicalization process strictly sorts all object keys.
2. **Exclusion of Self-Referential Proof Hash (`issuedProofHash`)**: The `issuedProofHash` field is added to IPFS metadata for human convenience, but is **strictly excluded** from the input of the canonicalizer before computing the SHA-256 hash (Decision 2.8).
3. **No Unnecessary Whitespace**: The canonical JSON string contains zero spaces after colons, commas, brackets, or braces.
4. **UTF-8 Encoding**: The canonical string is encoded into UTF-8 bytes before hashing.
5. **SHA-256 Digest**: The hash is computed as standard 256-bit SHA-256, formatted as a 0x-prefixed 64-character lowercase hex string (`bytes32`).

---

## 2. Canonicalization Rules

- **Object Properties**: Keys are recursively sorted by UTF-16 code unit order (standard JavaScript `<` / `>` string comparison).
- **Arrays**: Elements maintain their exact original order (array ordering represents intentional data sequence).
- **Numbers**: Serialized using standard ECMAScript `Number.prototype.toString()`.
- **Strings**: Encoded with standard JSON string escaping.
- **Null & Booleans**: Serialized as literal `null`, `true`, and `false`.
- **Ignored / Undefined Fields**: `undefined` values and the key `"issuedProofHash"` are omitted entirely.

---

## 3. Worked Example

### Step 1: Input JSON Object (un-ordered, with extra field)

```json
{
  "description": "Awarded for exceptional mastery in Solidity.",
  "issuedProofHash": "0x1234567890abcdef...",
  "certificateTitle": "Certified Blockchain Architect",
  "issuerAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "recipientIdentifier": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "issueDate": "2026-09-24T00:00:00.000Z",
  "schemaVersion": "1.0",
  "recipientName": "Alice Developer",
  "expiryDate": null,
  "issuerName": "CertiChain Academy",
  "additionalFields": {
    "grade": "Distinction",
    "courseId": "SOL-401"
  }
}
```

### Step 2: Canonical Serialized String

Excluding `issuedProofHash` and recursively sorting keys alphabetically:

```json
{"additionalFields":{"courseId":"SOL-401","grade":"Distinction"},"certificateTitle":"Certified Blockchain Architect","description":"Awarded for exceptional mastery in Solidity.","expiryDate":null,"issueDate":"2026-09-24T00:00:00.000Z","issuerAddress":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","issuerName":"CertiChain Academy","recipientIdentifier":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8","recipientName":"Alice Developer","schemaVersion":"1.0"}
```

### Step 3: Compute SHA-256 Digest

1. Encode string to UTF-8 bytes.
2. Calculate `crypto.subtle.digest('SHA-256', bytes)`.
3. Hex encode and prefix with `0x`.

Resulting on-chain `proofHash` (and `certId`):
```
0x<64_hex_chars>
```

---

## 4. Verification Algorithm (Pseudo-code)

```typescript
function verifyMetadataIntegrity(pinnedJson: object, onChainProofHash: string): boolean {
  // 1. Remove issuedProofHash if present
  const { issuedProofHash, ...canonicalPayload } = pinnedJson;

  // 2. Canonicalize
  const canonicalString = canonicalize(canonicalPayload);

  // 3. Compute SHA-256
  const recomputedHash = sha256Hex(canonicalString);

  // 4. Compare with on-chain record
  return recomputedHash.toLowerCase() === onChainProofHash.toLowerCase();
}
```
