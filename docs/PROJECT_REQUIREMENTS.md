# CertiChain Ledger — Project Requirements

## 1. Purpose & Scope

CertiChain Ledger is a decentralized credential issuance, verification, and
lifecycle-management system. It replaces forgeable paper/PDF certificates and
centralized verification portals with an EVM smart-contract registry anchored
to SHA-256 proof hashes, with full metadata stored on IPFS (pinned via
Pinata). This document defines **what** the system must do. Coding standards
and formatting rules live in `CONVENTIONS.md`.

Prototype scope: a single EVM-compatible testnet (e.g. Sepolia), a React +
TypeScript SPA, MetaMask wallet integration via `ethers.js`, and Pinata for
IPFS pinning. Multi-chain support, gasless meta-transactions, and a native
mobile app are explicitly **out of scope** (see §9).

## 2. System Actors

| Actor | Description | Key Capabilities |
|---|---|---|
| **Contract Owner / Admin** | Deploys the registry, manages issuer whitelist | Add/remove issuers, pause contract, transfer ownership |
| **Issuer** | Authorized institution/entity (school, employer, certifying body) | Issue certificates, revoke certificates they issued |
| **Recipient** | Credential holder | View own certificates, export PDF/PNG, share verification link |
| **Verifier** (public, no wallet required) | Any third party checking authenticity | Query certificate status by hash/ID, view issuer identity, timestamp, ACTIVE/REVOKED state |

## 3. Functional Requirements

### 3.1 Smart Contract Layer — `CertificateRegistry.sol`

- **FR-1.1** Maintain a mapping from a unique certificate ID (`bytes32`,
  derived from the SHA-256 proof hash) to a `Certificate` struct containing:
  issuer address, recipient address (optional, may be zero if
  off-chain-identified), `bytes32 proofHash`, `string metadataUrl` (IPFS
  URI), `uint256 issuedAt`, `bool revoked`, `uint256 revokedAt`.
- **FR-1.2** `issueCertificate(bytes32 proofHash, string metadataUrl, address recipient)`
  — callable only by whitelisted issuer addresses; reverts on duplicate
  `proofHash`. Emits `CertificateIssued(certId, issuer, recipient, proofHash, metadataUrl, timestamp)`.
- **FR-1.3** `revokeCertificate(bytes32 certId, string reason)` — callable
  only by the original issuing address (or contract owner as override);
  reverts if already revoked. Emits `CertificateRevoked(certId, issuer, timestamp, reason)`.
- **FR-1.4** `verifyCertificate(bytes32 certId)` — public `view` function
  returning full struct data (issuer, recipient, proofHash, metadataUrl,
  issuedAt, revoked, revokedAt) for zero-cost, wallet-free verification.
- **FR-1.5** `isIssuerAuthorized(address)` — public `view` function.
- **FR-1.6** Access control: `addIssuer(address)`, `removeIssuer(address)` —
  owner-only.
- **FR-1.7** Emergency `pause()` / `unpause()` — owner-only; blocks new
  issuance while paused, does not block verification reads.
- **FR-1.8** Reject issuance where `proofHash == bytes32(0)` or
  `metadataUrl` is empty.
- **FR-1.9** All state-changing functions must follow
  checks-effects-interactions and use custom errors (not `require` strings)
  for gas efficiency.

### 3.2 Decentralized Storage Pipeline

- **FR-2.1** Client-side SHA-256 hashing of the canonicalized certificate
  JSON payload using the browser `SubtleCrypto` API (no server round-trip).
- **FR-2.2** Automated pinning of the full metadata JSON object to IPFS via
  the Pinata API (`pinJSONToIPFS`), returning a CID.
- **FR-2.3** Gateway URL construction (configurable Pinata gateway, with a
  public IPFS gateway fallback) stored as `metadataUrl` on-chain.
- **FR-2.4** Metadata JSON schema (see §4.2) must be validated client-side
  before hashing/pinning to guarantee the on-chain hash is reproducible.
- **FR-2.5** Pinning failures must be retried with exponential backoff (max
  3 attempts) and surfaced to the user with an actionable error.

### 3.3 Web3 Application Interface (React + TypeScript)

- **FR-3.1** Wallet connect/disconnect via MetaMask (`ethers.js` v6
  `BrowserProvider`), with live account and network-change listeners.
- **FR-3.2** Network guard: detect wrong chain and prompt a switch/add
  network request.
- **FR-3.3** Issuer dashboard: form to create a certificate (recipient name,
  recipient address/email, course/credential title, issue date, additional
  fields), live preview, "Issue on-chain" transaction flow with pending →
  confirmed → error states.
- **FR-3.4** Transaction monitoring: show tx hash, block explorer link,
  confirmation count, and final receipt status.
- **FR-3.5** Recipient dashboard: list certificates owned by connected
  address (via event log query / subgraph-free indexing using
  `queryFilter` on `CertificateIssued`).
- **FR-3.6** Global toast/banner system for network errors, tx failures,
  and IPFS pinning errors.

### 3.4 Verification & Audit Dashboard

- **FR-4.1** Public verification page (no wallet required) accepting a
  certificate ID, hash, or shareable verification link/QR code.
- **FR-4.2** Fetch on-chain record via `verifyCertificate`, fetch metadata
  JSON from IPFS gateway, recompute SHA-256 client-side, and compare against
  the on-chain `proofHash`.
- **FR-4.3** Display a clear tri-state result: **VALID** (hash matches, not
  revoked), **REVOKED** (hash matches, revoked — show reason + timestamp),
  **INVALID/TAMPERED** (hash mismatch or record not found).
- **FR-4.4** Display issuer address (with authorized-issuer badge), block
  timestamp, and a link to the raw IPFS metadata.
- **FR-4.5** Shareable verification URL generation
  (`/verify/:certId`) and QR code rendering for print/export.

### 3.5 Visual Asset & Export Engine

- **FR-5.1** Live-updating certificate preview component reflecting form
  input in real time (issuer dashboard) or on-chain/IPFS data (recipient
  view).
- **FR-5.2** Export to PDF (print-ready, A4/Letter) and PNG (high-resolution,
  ≥1920px width) entirely client-side (e.g. `html2canvas` + `jspdf`), with
  no server processing of the rendered asset.
- **FR-5.3** Exported files embed the verification URL / QR code so a
  printed copy remains independently verifiable.

## 4. Data Models

### 4.1 On-Chain `Certificate` Struct

```solidity
struct Certificate {
    address issuer;
    address recipient;
    bytes32 proofHash;
    string  metadataUrl;
    uint256 issuedAt;
    bool    revoked;
    uint256 revokedAt;
}
```

### 4.2 IPFS Metadata JSON Schema (pinned payload)

```json
{
  "schemaVersion": "1.0",
  "certificateTitle": "string",
  "recipientName": "string",
  "recipientIdentifier": "string (address or email)",
  "issuerName": "string",
  "issuerAddress": "0x...",
  "issueDate": "ISO-8601",
  "expiryDate": "ISO-8601 | null",
  "description": "string",
  "additionalFields": { "key": "value" },
  "issuedProofHash": "0x... (self-referential, set before hashing to null then recomputed, OR excluded from hash input — decide and document one approach)"
}
```
> The exact canonicalization rule (key ordering, whitespace, which fields are
> excluded before hashing) must be fixed in code and documented, since the
> hash must be deterministically reproducible by any third-party verifier.

## 5. Non-Functional Requirements

- **NFR-1 Security:** No private keys or Pinata secret keys in client
  bundle; Pinata JWT/secret must be used only via a minimal serverless proxy
  or environment-scoped build secret — never shipped to the browser in
  plaintext for production use.
- **NFR-2 Gas Efficiency:** Custom errors over require-strings; packed
  struct storage where feasible; avoid on-chain loops over unbounded arrays.
- **NFR-3 Availability:** No single point of failure for verification —
  verification must succeed given only an RPC endpoint and an IPFS gateway,
  with no proprietary backend dependency.
- **NFR-4 Usability:** Verification flow must be completable by a
  non-crypto-native user (employer/HR) without connecting a wallet.
- **NFR-5 Auditability:** All state changes emit events sufficient to
  reconstruct full certificate history off-chain without a database.
- **NFR-6 Testability:** ≥90% branch coverage on `CertificateRegistry.sol`.

## 6. Technology Stack

- **Smart Contracts:** Solidity ^0.8.24, Hardhat (or Foundry), OpenZeppelin
  (`Ownable2Step`, `Pausable`), Hardhat-deploy or a scripts-based deployment
  flow.
- **Frontend:** React 18+, TypeScript (strict mode), Vite, `ethers.js` v6,
  TailwindCSS.
- **Storage:** Pinata SDK/REST API, public IPFS gateway fallback (e.g.
  `ipfs.io` or Cloudflare IPFS).
- **Export:** `html2canvas`, `jspdf`, a QR code library (e.g. `qrcode`).
- **Testing:** Hardhat + Chai/Mocha (or Foundry `forge test`) for contracts;
  Vitest + React Testing Library for frontend.

## 7. Deployment Targets

- Contract: public EVM testnet (Sepolia) for prototype; verified on the
  relevant block explorer (Etherscan-compatible) via `hardhat-verify`.
- Frontend: static hosting (Vercel/Netlify-compatible build output).

## 8. Acceptance Criteria (Definition of Done)

| Output | Done when… |
|---|---|
| Smart Contract | All FR-1.x implemented, tests pass at ≥90% coverage, deployed + verified on testnet |
| Web3 App | Wallet connect, issue flow, and recipient view work end-to-end against the deployed contract |
| Storage Pipeline | A payload can be hashed, pinned, and the returned CID resolves via gateway to identical bytes |
| Verification Dashboard | Given a valid certId, tampered payload, and revoked certId, the three tri-states render correctly |
| Export Engine | PDF and PNG exports open correctly and embed a scannable, working verification QR code |

## 9. Out of Scope (Prototype)

- Multi-chain / cross-chain issuance
- Gasless meta-transactions / account abstraction
- Native mobile applications
- DID (Decentralized Identifier) standard compliance
- Institutional SSO / KYC of issuers beyond owner-managed whitelist
- Subgraph/indexer infrastructure (event querying via direct RPC is
  acceptable for prototype scale)
