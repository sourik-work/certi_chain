# CertiChain Ledger

**Decentralized, Immutable Credential Issuance, Verification & Lifecycle Platform**

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-v5.1.0-4E5EE4?logo=openzeppelin)](https://openzeppelin.com/)
[![Contract Coverage](https://img.shields.io/badge/Contracts_Coverage-100%25-success)](contracts/test/CertificateRegistry.test.ts)
[![Frontend Tests](https://img.shields.io/badge/Frontend_Tests-160_passed-success)](frontend/src/test/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT_(Contract)_%7C_Private_(Monorepo)-lightgrey)](contracts/src/CertificateRegistry.sol)

---

## 1. Description

CertiChain Ledger is a decentralized credential issuance, verification, and lifecycle-management system that replaces easily forgeable paper/PDF certificates and centralized verification portals with an immutable Ethereum Virtual Machine (EVM) smart contract registry anchored to SHA-256 cryptographic proof hashes, coupled with decentralized IPFS metadata storage pinned via Pinata.

The system serves authorized institutional issuers (universities, accreditation councils, enterprises), credential recipients (graduates, certificate holders), and third-party verifiers (employers, background checkers). By computing deterministic RFC 8785 JSON Canonicalization Scheme (JCS) digests in client memory and anchoring proof hashes on-chain, CertiChain Ledger enables instant, zero-cost, walletless public verification that mathematically guarantees authentic, tamper-evident credentials without relying on centralized databases.

---

## 2. Key Features

- **Decentralized On-Chain Registry**: Solidity 0.8.24 smart contract with packed 4-slot storage layout, `Ownable2Step` access control, `Pausable` circuit breaker, and 100% branch test coverage.
- **RFC 8785 Canonical Cryptographic Proofs**: Deterministic client-side SHA-256 hashing (`proofHash == certId`) with self-referential hash exclusion and multi-artifact integrity validation.
- **Custom Certificate Studio with AI Assistance**: Vision LLM & OCR field extraction, background placeholder inpainting, auto-fitting typography, and Canva/Figma import/export bridges.
- **Serverless Secret Isolation & IPFS Storage**: Server-side Pinata JWT proxy (`/api/pinJson`, `/api/pinFile`) ensuring zero credential leaks in client bundles with automated size budgeting (3.2 MB ceiling).
- **Universal Walletless Verification**: Public `/verify/:certId` portal enabling anyone to verify authenticity, detect tampering, inspect IPFS payloads, and view rendered artifacts with zero wallet installation.

---

## 3. Tech Stack

- **Smart Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin Contracts v5.1.0 (`Ownable2Step`, `Pausable`), TypeChain, Ethers.js v6.
- **Frontend Architecture**: React 18, TypeScript (Strict Null Checks), Vite, TailwindCSS, Lucide React icons.
- **Cryptographic & Binary Pipeline**: WebCrypto SubtleCrypto API (zero network round-trip SHA-256), RFC 8785 JCS canonicalizer, PDF.js canvas rasterization, ExifReader metadata sanitizer.
- **Decentralized Storage**: Pinata IPFS Gateway integration via Vercel Serverless Functions with idempotent retry backoff.
- **Testing & Tooling**: Vitest 2.1.9, Happy-DOM, Hardhat Network, Chai Matchers, Solidity Coverage.

---

## 4. Architecture

```
                        +---------------------------------------------+
                        |           React 18 + TypeScript SPA         |
                        | (Issuer, Recipient, & Verification Portals) |
                        +----------------------+----------------------+
                                               |
                     +-------------------------+-------------------------+
                     |                                                   |
                     v                                                   v
        +--------------------------+                        +--------------------------+
        |  EVM Smart Contract      |                        |  IPFS Storage Pipeline   |
        |  (CertificateRegistry)   |                        |  (RFC 8785 Canonicalizer |
        |                          |                        |   & Serverless Proxy)    |
        +--------------------------+                        +--------------------------+
        | - Packed 4-slot struct   |                        | - JCS UTF-16 Code Sort   |
        | - Custom Errors          |                        | - Browser SubtleCrypto   |
        | - Ownable2Step & Pausable|                        | - Pinata /api/pinJson    |
        | - 3-indexed Event Logs   |                        | - Fallback IPFS Gateway  |
        +--------------------------+                        +--------------------------+
```

---

## 5. Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

```bash
# 1. Clone repository
git clone https://github.com/sourik-work/certi_chain.git
cd certi_chain

# 2. Install workspace dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp contracts/.env.example contracts/.env

# 4. Run smart contract test suite (24 tests, 100% coverage)
npm --workspace=contracts test

# 5. Run frontend test suite (160 tests across 27 suites)
npm --workspace=frontend test -- --run

# 6. Launch local development environment
npm --workspace=frontend run dev
```

---

## 6. Test Results & Coverage

```
Smart Contract Test Suite (contracts/test/CertificateRegistry.test.ts):
  24 passing (2s)
  100% Branch Coverage | 100% Function Coverage | 100% Line Coverage

Frontend Test Suite (Vitest):
  Test Files  27 passed (27)
  Tests       160 passed (160)
  Duration    24.5s
```

---

## 7. Documentation Index

Detailed engineering specifications and guides are available in the [`/docs`](docs/) directory:

- [`docs/PROJECT_REQUIREMENTS.md`](docs/PROJECT_REQUIREMENTS.md) — Master functional & non-functional requirements, data schemas, and acceptance criteria.
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — Architectural standards, code quality guidelines, and security checklists.
- [`docs/HASHING.md`](docs/HASHING.md) — Cryptographic proof derivation, RFC 8785 canonicalization, and self-referential hash exclusion rules.
- [`docs/CUSTOM_TEMPLATES.md`](docs/CUSTOM_TEMPLATES.md) — Custom Certificate Studio architecture, AI vision field detection, and Canva/Figma handoff.
- [`docs/AI_LAYOUT_REDESIGN_PLAN.md`](docs/AI_LAYOUT_REDESIGN_PLAN.md) — AI layout planning and inpainting engine specification.
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — Complete milestone traceability matrix and phase verification logs.
- [`docs/README_SOURCE_DOSSIER.md`](docs/README_SOURCE_DOSSIER.md) — Fully cited technical dossier and evidence inventory.

---

## 8. Recent Cryptographic Hardening

| Defect ID | Symptom | Root Cause | Guard & Verification |
|---|---|---|---|
| **BUG-001** | Template hash mismatch between issuer upload and IPFS verification. | `templateHash` was computed on raw client file bytes prior to EXIF stripping; Pinata received cleaned bytes. | `TemplateUploader.tsx` re-ordered to compute SHA-256 *after* EXIF sanitization. Verified in `customCertificateLifecycle.test.ts`. |
| **BUG-002** | HTTP 413 / `PIN_PAYLOAD_TOO_LARGE` on high-resolution template uploads. | Canvas rasterization generated uncompressed data URLs exceeding serverless payload thresholds. | `optimizeCanvasToDataUrl` with 3.2 MB preflight budget enforcement and progressive JPEG/WebP compression. Verified in `customCertificateLifecycle.test.ts`. |
| **BUG-003** | Custom certificate verification reported `INVALID_TAMPERED` on authentic assets. | `verify.ts` re-encoded fetched images into strings before hashing rather than inspecting raw binary bytes. | `fetchArtifactBytes` streams raw `Uint8Array` bytes directly into WebCrypto SHA-256. Verified in `customCertificateLifecycle.test.ts`. |
| **BUG-004** | Verification portal displayed blank initial template instead of finalized issued certificate. | `VerificationResult.tsx` only loaded `templateCid` and ignored `renderedCid`. | `CustomCertificatePreview.tsx` created to securely resolve and render verified `renderedDataUrl`. Verified in `customCertificateLifecycle.test.ts`. |

---

## 9. Security Model

1. **Zero Secret Leakage in Client Bundles**: All Pinata JWT credentials reside exclusively within serverless proxies (`api/pinJson.ts`, `api/pinFile.ts`). Client bundles contain 0 sensitive keys.
2. **Access Control & Circuit Breakers**: Registry modification is strictly limited to authorized issuers via `onlyAuthorizedIssuer`. Registry ownership transfers use two-step confirmation (`Ownable2Step`), and emergency pausing is supported via `Pausable`.
3. **Deterministic Canonicalization**: RFC 8785 UTF-16 code-unit sorting prevents key-ordering discrepancies across different client runtimes and platforms.
4. **Client-Side Input Sanitization**: All user strings are sanitized against XSS attacks prior to schema validation and IPFS anchoring.
5. **Untrusted IPFS Payload Treatment**: Content fetched from decentralized gateways is treated as untrusted and strictly checked against on-chain SHA-256 hashes prior to rendering.
6. **Isolated Proof Hashing**: Self-referential `issuedProofHash` fields are stripped prior to hashing to guarantee mathematical immutability.

---

## 10. Roadmap

- `[READY]` **Sepolia Testnet Deployment**: Smart contracts compiled with 100% coverage, ready for live broadcast upon testnet gas funding.
- `[READY]` **Etherscan Contract Verification**: Automated TypeScript verification scripts prepared for automated deployment verification.
- `[BLOCKED: External Gateway Rate Limits]` **Decentralized Multi-Gateway Failover**: Additional redundant IPFS gateway endpoints pending production domain configuration.
- `[SPECULATIVE]` **Batch Minting & Merkle Trees**: Merkle tree root anchoring on-chain for gas-efficient bulk institutional issuance.
- `[SPECULATIVE]` **ERC-4337 Account Abstraction**: Gasless sponsored credential issuance for enterprise issuers.

---

## 11. Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/credential-enhancement`)
3. Commit your changes following Conventional Commits (`git commit -m 'feat(crypto): add batch merkle verification'`)
4. Verify tests pass (`npm --workspace=contracts test && npm --workspace=frontend test -- --run`)
5. Push to the branch (`git push origin feature/credential-enhancement`)
6. Open a Pull Request

---

## 12. License

- **Smart Contracts (`contracts/src/CertificateRegistry.sol`)**: [MIT License](contracts/src/CertificateRegistry.sol)
- **Monorepo Application Code**: Private / Copyright (c) 2026 CertiChain Ledger Contributors. All rights reserved.
