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

---

## 5. Custom Certificate Template Extension

When issuing a custom template certificate, an optional `custom` block is included in the metadata. Standard certificates remain byte-for-byte unchanged.

### 5.1 Custom Object Structure

```json
{
  "schemaVersion": "1.0",
  "certificateTitle": "Custom Award of Excellence",
  "issuerName": "Global Institute",
  "recipientName": "Devanagari \u0906\u0928\u0902\u0926 \u2728",
  "issuerAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "recipientIdentifier": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "issueDate": "2026-10-07T00:00:00.000Z",
  "custom": {
    "schemaVersion": 1,
    "templateHash": "0x4f8a8b...",
    "templateCid": "bafybeig...",
    "baseHash": "0x3c9d1a...",
    "baseCid": "bafybeif...",
    "renderedCid": "bafybeih...",
    "renderedHash": "0x7a9c1d...",
    "layoutHash": "0x2e3b4a...",
    "values": {
      "courseGrade": "A+",
      "recipientName": "Devanagari \u0906\u0928\u0902\u0926 \u2728"
    }
  }
}
```

### 5.2 Layout Hash Computation
The `layoutHash` seals the visual layout schema (bounding boxes, composite template strings, tokens, and font styling) independent of specific recipient values:
```typescript
const layoutPayload = {
  fields: template.fields.map(f => ({
    key: f.key,
    type: f.type,
    box: f.box,
    compositeTemplate: f.compositeTemplate || null,
    tokens: f.tokens || null,
    style: f.style
  }))
};
const layoutHash = sha256Hex(canonicalize(layoutPayload));
```

### 5.3 Multi-Artifact Verification Rule
In addition to checking `recomputedProofHash === onChainProofHash`:
1. `sha256Hex(templateBytes) === metadata.custom.templateHash`
2. If `baseCid` is present: `sha256Hex(cleanedBaseBytes) === metadata.custom.baseHash`
3. `sha256Hex(renderedImageBytes) === metadata.custom.renderedHash`
Any byte mutation in the template, cleaned base, or rendered certificate yields `TAMPERED`.

### 5.4 Byte Integrity & QR Code Anchoring
1. **Pinned Bytes Hashing Rule**: `templateHash` and `renderedHash` are computed over the EXACT binary bytes pinned to IPFS (after EXIF stripping, SVG sanitization, and canvas rasterization). Never compute the hash prior to normalization or stripping.
2. **Deterministic QR / ProofHash Derivation**: For Custom Certificates, `certId = proofHash` is deterministically derived from canonicalized metadata. The verification QR encodes `${PUBLIC_APP_URL}/verify/${certId}` and is rendered directly onto the canvas with a high-contrast light plate before computing `renderedHash` and pinning `renderedCid`.
3. **Mandatory QR in layoutHash**: The `qrCode` and `certId` fields are mandatory in every custom template's `fields` array and are serialized into `layoutHash`, guaranteeing that any tampering or relocation of the QR code alters the cryptographic proof.



