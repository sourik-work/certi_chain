# CertiChain Ledger — Build Progress

## Resume Pointer
Current phase: Project complete (Emblem Logo Updated)
Last completed exit-gate: Phase 10 exit-gate passed. Official CertiChain circular emblem logo replaced and integrated across Header, Footer, and web manifest/favicon. All 155 frontend tests & 24 contract tests passing green with clean production build.
Next action: None (Project complete)

## Status Legend
✅ Done & verified   🔶 In progress   ⛔ Blocked — see Blocked Items   ⬜ Not started

## Phase Checklist
- [x] Phase 0 — Repository & tooling bootstrap
- [x] Phase 1 — Smart contract: core registry
- [x] Phase 2 — Smart contract: tests & coverage
- [x] Phase 3 — Deployment & verification scripts
- [x] Phase 4 — Frontend scaffolding & wallet layer
- [x] Phase 5 — Storage & hashing pipeline
- [x] Phase 6 — Issuer dashboard & issuance flow
- [x] Phase 7 — Recipient dashboard
- [x] Phase 8 — Verification & audit dashboard
- [x] Phase 9 — Export engine
- [x] Phase 10 — Hardening, docs & final acceptance pass

## Traceability Matrix
| Req ID | Description | Implemented in | Tested in | Status | Notes |
|---|---|---|---|---|---|
| FR-1.1 | Certificate struct + mapping | contracts/src/CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | 4-slot packed struct, 100% test coverage |
| FR-1.2 | issueCertificate + event | contracts/src/CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | 3-indexed param event, duplicate checks verified |
| FR-1.3 | revokeCertificate + event | contracts/src/CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | Issuer + owner override, state transitions verified |
| FR-1.4 | verifyCertificate view | contracts/src/CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | Zero-cost view returning full struct |
| FR-1.5 | isIssuerAuthorized | contracts/src/CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | Public view verified |
| FR-1.6 | addIssuer / removeIssuer | contracts/src/CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | Ownable2Step owner only verified |
| FR-1.7 | pause / unpause | contracts/src/CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | Pausable issuance guard, view remains operational |
| FR-1.8 | zero-hash / empty-url guard | contracts/src/CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | InvalidProofHash, EmptyMetadataUrl custom errors |
| FR-1.9 | checks-effects-interactions, custom errors | contracts/src/CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | 100% branch coverage |
| FR-2.1 | client-side SHA-256 | frontend/src/lib/hash.ts | frontend/src/lib/hash.test.ts | ✅ | WebCrypto SubtleCrypto zero-roundtrip |
| FR-2.2 | Pinata pinJSONToIPFS | frontend/src/lib/pinata.ts, frontend/api/pinJson.ts | frontend/src/lib/pinata.test.ts | ✅ | Serverless proxy pattern |
| FR-2.3 | gateway URL construction | frontend/src/config.ts, lib/pinata.ts | frontend/src/lib/pinata.test.ts | ✅ | Configurable gateway & public fallback |
| FR-2.4 | schema validation pre-hash | frontend/src/lib/validateMetadata.ts | frontend/src/lib/validateMetadata.test.ts | ✅ | Schema v1.0, ISO dates, XSS sanitization |
| FR-2.5 | retry w/ exponential backoff | frontend/src/lib/pinata.ts | frontend/src/lib/pinata.test.ts | ✅ | Max 3 attempts with exponential delay |
| FR-3.1 | wallet connect/disconnect | frontend/src/hooks/useWallet.ts | | ✅ | ethers v6 BrowserProvider & live event listeners |
| FR-3.2 | network guard | frontend/src/components/NetworkGuard.tsx | | ✅ | Wrong chain detection & switch prompt |
| FR-3.3 | issuer dashboard + issue flow | frontend/src/pages/IssuerDashboard.tsx, hooks/useCertificateRegistry.ts | | ✅ | Sanitized issuance form & TypeChain hook |
| FR-3.4 | tx monitoring | frontend/src/components/TransactionStatus.tsx | | ✅ | Multistep pipeline tracker & receipt |
| FR-3.5 | recipient dashboard via queryFilter | frontend/src/pages/RecipientDashboard.tsx | | ✅ | queryFilter log queries on indexed recipient |
| FR-3.6 | toast/banner system | frontend/src/components/Toast*.tsx | | ✅ | Global multi-variant toast notifications |
| FR-4.1 | public verify page (id/hash/link/QR) | frontend/src/pages/VerifyCertificate.tsx | | ✅ | Public walletless route & search |
| FR-4.2 | fetch + recompute + compare | same, frontend/src/lib/verify.ts | | ✅ | Canonicalization + re-hashing verification |
| FR-4.3 | tri-state renderer | frontend/src/components/VerificationResult.tsx | frontend/src/components/VerificationResult.test.tsx | ✅ | Mandatory unit tests green |
| FR-4.4 | issuer badge, timestamp, raw link | VerificationResult.tsx | | ✅ | Authorized badge, IPFS link, block timestamp |
| FR-4.5 | shareable URL + QR | frontend/src/components/VerificationResult.tsx | | ✅ | QR modal + one-click link copying |
| FR-5.1 | live preview (shared component) | frontend/src/components/CertificatePreview.tsx | | ✅ | Reusable preview in 3 contexts |
| FR-5.2 | PDF/PNG export | frontend/src/lib/export.ts | | ✅ | jsPDF + html2canvas client-side export |
| FR-5.3 | embed verification QR in export | export.ts, CertificatePreview.tsx | | ✅ | Embedded scannable QR in exported asset |
| NFR-1 | no secrets in client bundle | frontend/api/pinJson.ts | | ✅ | Serverless proxy with server-side PINATA_JWT |
| NFR-2 | gas efficiency / packed struct | CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | 4-slot layout |
| NFR-3 | no SPOF for verification | VerifyCertificate.tsx | | ✅ | Direct RPC + IPFS gateway resolution |
| NFR-4 | walletless verification UX | VerifyCertificate.tsx | | ✅ | Zero wallet requirement for public verification |
| NFR-5 | auditability via events | CertificateRegistry.sol | contracts/test/CertificateRegistry.test.ts | ✅ | Indexed events tested |
| NFR-6 | ≥90% branch coverage | contracts/test/*, hardhat coverage | hardhat coverage | ✅ | 100% branch coverage |
| CC-1 | Custom Template Upload & Field Mapping | frontend/src/components/custom/* | frontend/src/test/customCertificateLifecycle.test.ts | ✅ | Multi-layer template studio & revision history |
| CC-2 | AI Layout Redesign & OCR Pass | frontend/api/planLayout.ts, frontend/src/lib/ocrService.ts | frontend/src/test/aiLayoutRedesign.test.ts | ✅ | Line extraction, schema-validated JSON layout planner |
| CC-3 | Base Image Cleaning Engine | frontend/src/lib/cleanBase.ts | frontend/src/test/aiLayoutRedesign.test.ts | ✅ | Background sampling & mask erase preserving brand assets |
| CC-4 | CompositeText & Deterministic Rendering | frontend/src/lib/renderCertificate.ts | frontend/src/test/aiLayoutRedesign.test.ts | ✅ | Tokenized variable phrases with auto-fit font hierarchy |
| CC-5 | Layout Validator & Multi-Artifact Integrity | frontend/src/lib/layoutValidator.ts, frontend/src/lib/verify.ts | frontend/src/test/multiArtifactVerification.test.ts | ✅ | Base hash, layout hash & metadata cryptographic verification |
| FR-CT-1 | 4-step stepper & segmented tab switcher | frontend/src/pages/IssuerDashboard.tsx | frontend/src/test/ | ✅ | Standard Certificate untouched; Custom tab active |
| FR-CT-2 | Template ingestion & magic bytes validation | frontend/src/components/custom/TemplateUploader.tsx | frontend/src/lib/stripExif.test.ts | ✅ | PNG/JPG/WEBP/PDF/SVG <=15MB, EXIF stripped |
| FR-CT-3 | Client-side PDF rasterization | frontend/src/lib/pdfRaster.ts | frontend/src/lib/pdfRaster.test.ts | ✅ | Page 1 rasterized at 2x via pdfjs-dist |
| FR-CT-4 | AI Vision field detection & fallback | frontend/api/analyzeTemplate.ts | frontend/src/lib/templateAnalysis.test.ts | ✅ | Gemini vision LLM + 0.25% grid snapping + OCR fallback |
| FR-CT-5 | Dynamic form generator & schema binding | frontend/src/components/custom/DynamicForm.tsx | frontend/src/test/ | ✅ | Reactive form rebuild on schema changes |
| FR-CT-6 | Deterministic typography & live preview | frontend/src/lib/renderCertificate.ts | frontend/src/test/ | ✅ | Auto-shrink-to-fit, word wrap, canvas preview |
| FR-CT-7 | Canva Connect integration | frontend/src/lib/editors/canva.ts | frontend/src/test/ | ✅ | OAuth 2.0 PKCE design round-trip |
| FR-CT-8 | Figma SVG handoff & plugin | frontend/src/lib/editors/figma.ts, figma-plugin/ | frontend/src/test/ | ✅ | field:<key> layer mapping & SVG import/export |
| FR-CT-9 | Multi-artifact IPFS pinning & on-chain anchor | frontend/src/pages/IssuerDashboard.tsx | frontend/src/test/ | ✅ | Template file + rendered PNG + canonical metadata |
| FR-CT-10 | Multi-artifact verification (template/rendered/metadata) | frontend/src/lib/verify.ts | frontend/src/test/ | ✅ | Tri-state + custom template integrity validation |
| FIX-A-PIN | IPFS Binary Pin Proxy & Typed Error System | frontend/api/pinFile.ts, frontend/src/lib/pinata.ts, frontend/src/lib/pinErrors.ts | frontend/src/test/pinFileAndQrValidation.test.ts, scripts/smoke-pin.ts | ✅ | Diagnostic endpoint, typed PIN_* error codes, exponential backoff, in-session idempotent caching, pre/post SHA-256 byte verification |
| FIX-B-QR | Mandatory QR Code Auto-Insertion & Canvas Decoding | frontend/src/lib/qrHelper.ts, frontend/src/lib/renderCertificate.ts, frontend/src/hooks/useCustomTemplate.ts | frontend/src/test/pinFileAndQrValidation.test.ts | ✅ | Safe-zone default placement, min-size/quiet-zone scannability enforcement, dark background light-plate, jsQR verified |

## Deviations From Spec
- *2026-09-24* — Decision 2.1: pinned exact compiler version `0.8.24` (no floating `^`).
- *2026-09-24* — Decision 2.2: `certId == proofHash` direct identity mapping.
- *2026-09-24* — Decision 2.4: 4-slot packed `Certificate` storage struct.
- *2026-09-24* — Decision 2.5: Indexed 3 event parameters for `CertificateIssued(certId, issuer, recipient)`.
- *2026-09-24* — Decision 2.8: RFC 8785 canonicalization with UTF-16 code unit key sorting and `issuedProofHash` field excluded before hashing.
- *2026-09-24* — Decision 2.9: `frontend/api/pinJson.ts` serverless proxy pattern for `PINATA_JWT`.
- *2026-10-07* — Custom Certificate tab implementation without smart contract modifications or schema breaking changes.

## Blocked Items
- **Sepolia Testnet Deployment**: Needs `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY` (with testnet ETH), and `ETHERSCAN_API_KEY` in `contracts/.env` to deploy and verify on live Sepolia testnet. Local development, automated testing (100% branch coverage), and local node deployment (`scripts/deploy.ts`) are completely verified.

## Security Checklist (mirrors CONVENTIONS.md §10)
- [x] No secret keys committed or shipped in the frontend bundle (verified via `frontend/api/pinJson.ts` and `frontend/api/pinFile.ts`)
- [x] All Solidity state-mutating functions have access control (verified via `onlyAuthorizedIssuer`, `onlyOwner`, `whenNotPaused`)
- [x] Custom errors used, no string-based require (verified across all custom error paths)
- [x] Contract compiled with no compiler warnings (verified via `hardhat compile` with zero warnings)
- [x] Frontend validates/sanitizes all user-entered text before hashing/rendering (verified via `validateAndSanitizeMetadata` and unit tests)
- [x] IPFS-fetched content treated as untrusted input when rendered (verified via strict sanitization and cryptographic proofHash verification)
- [x] Custom Certificate SVG/EXIF sanitized client-side before hashing and pinning

## Acceptance Criteria (mirrors PROJECT_REQUIREMENTS.md §8 & Master Prompt §10.2)
- [x] Smart Contract — all FR-1.x done, 100% coverage (24/24 tests passing), deploy script verified on local node
- [x] Web3 App — wallet connect, issue flow, recipient view work end-to-end against deployed contract
- [x] Storage Pipeline — payload hashed client-side with SHA-256, pinned via proxy, gateway resolution verified
- [x] Verification Dashboard — valid / tampered / revoked certId all render the correct tri-state (verified via automated test cases)
- [x] Export Engine — PDF and PNG client-side exports open correctly with a scannable, working verification QR code
- [x] AC1-AC10 Custom Certificate — 4-step stepper, AI detection, dynamic form, Canva/Figma handoff, multi-artifact IPFS anchoring & verification integrity passed.

