# GEMINI.md — CertiChain Ledger project rules

Read docs/PROGRESS.md and this file first, every session, before any other action.

## Stack
Solidity 0.8.24 (exact pin, no ^), Hardhat, OpenZeppelin v5.x (Ownable2Step, Pausable),
TypeChain. React 18 + TypeScript strict + Vite, ethers v6, TailwindCSS. npm workspaces
(contracts, frontend). Pinata for IPFS pinning via a serverless proxy — never direct
from the browser.

## Non-negotiable rules
- Custom errors only in Solidity; no require(cond, "string").
- Checks-effects-interactions on every state-mutating contract function.
- Full NatSpec on every public/external function and event.
- No `any` in TypeScript app code; strictNullChecks on.
- All wallet/contract/IPFS logic lives in hooks under frontend/src/hooks — components
  stay presentational.
- Canonicalization + hashing logic lives in exactly one module (frontend/src/lib/
  canonicalize.ts + hash.ts) and is reused by issuance, export, and verification —
  never reimplemented.
- CertificatePreview is one component, reused in editor/recipient/export contexts.
- No secrets under frontend/src — the Pinata JWT lives only in the frontend/api
  serverless function's server-side environment.
- Conventional Commits; contract and frontend changes in the same task get separate
  commits.

## Full spec
See docs/CONVENTIONS.md (how) and docs/PROJECT_REQUIREMENTS.md (what). See the
master build prompt's Section 2 for resolved design decisions — do not re-decide
those.
