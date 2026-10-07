# CertiChain Ledger — Conventions & Coding Standards

This document defines **how** the codebase must be written. Pair with
`PROJECT_REQUIREMENTS.md`, which defines what must be built.

## 1. Repository Structure

```
certichain-ledger/
├── contracts/
│   ├── src/
│   │   └── CertificateRegistry.sol
│   ├── test/
│   ├── scripts/
│   │   ├── deploy.ts
│   │   └── verify.ts
│   ├── hardhat.config.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/            # ethers, pinata, hashing utilities
│   │   ├── pages/
│   │   ├── types/
│   │   ├── contracts/      # ABI + generated types (via TypeChain)
│   │   └── App.tsx
│   ├── public/
│   └── package.json
├── docs/
│   ├── PROJECT_REQUIREMENTS.md
│   ├── CONVENTIONS.md
│   └── PROGRESS.md         # maintained by the build agent, see master prompt
└── README.md
```

Contracts and frontend are separate npm workspaces (or a pnpm/yarn
workspace monorepo). No frontend code imports contract source directly;
it consumes generated ABI/typings only.

## 2. General Principles

1. **Determinism first.** Anything that affects the on-chain hash
   (canonical JSON, field ordering) must be implemented once, in one
   utility module, and reused everywhere it's needed (issuance, export,
   verification) — never re-implemented ad hoc.
2. **No silent failures.** Every async operation (tx send, IPFS pin, hash
   compute) must have explicit loading/success/error states surfaced to
   the UI.
3. **No secrets in client bundles.** Anything under `frontend/src` is
   public. API keys with write/spend privileges never go there.
4. **Small, single-purpose functions/components.** Prefer composition over
   large multi-responsibility files.
5. **Comment the "why," not the "what."** Code should be self-explanatory
   for the "what"; comments explain non-obvious decisions (e.g. why a
   field is excluded from the hash payload).

## 3. Solidity Standards

- **Version:** pin an exact compiler version (`pragma solidity 0.8.24;` —
  no floating `^` in the deployed contract).
- **Style:** follow the official Solidity Style Guide (4-space indent,
  `CapWords` for contracts/structs/events, `mixedCase` for functions and
  state variables, `UPPER_SNAKE_CASE` for constants).
- **Errors:** use custom errors (`error Unauthorized();`) instead of
  `require(cond, "string")` for every revert path.
- **Ordering:** within a contract — state variables, events, errors,
  modifiers, constructor, external, public, internal, private functions.
- **NatSpec:** every public/external function and event gets a full
  `@notice` / `@param` / `@return` NatSpec block.
- **Security patterns:**
  - Checks-effects-interactions on every state-mutating function.
  - Use OpenZeppelin's `Ownable2Step` (not single-step `Ownable`) and
    `Pausable`.
  - No `tx.origin` for auth. No unbounded loops over storage arrays.
  - Reentrancy is not expected given no external calls in state-mutating
    paths, but any future external call must use the `nonReentrant`
    modifier.
- **Events:** every state change emits an event with indexed fields for
  anything a frontend will filter on (`certId`, `issuer` indexed).
- **Testing:** one test file per contract; test names follow
  `describe("FunctionName")` → `it("reverts when X")` / `it("succeeds when Y")`.
  Cover: happy path, access-control failures, duplicate/replay attempts,
  paused-state behavior, and event emission assertions.

## 4. TypeScript / React Standards

- **TypeScript strict mode on.** `noImplicitAny`, `strictNullChecks` both
  true. No `any` in application code; use `unknown` + narrowing if a type
  is genuinely unknown.
- **Components:** functional components only, one component per file, file
  name matches the default export (`CertificatePreview.tsx` exports
  `CertificatePreview`).
- **Hooks:** all wallet/contract/IPFS interaction logic lives in custom
  hooks under `src/hooks/` (`useWallet`, `useCertificateRegistry`,
  `usePinata`) — components stay presentational and call hooks, they don't
  construct `ethers` providers or fetch calls directly.
- **State management:** local component state + React Context for wallet
  session; no external state library needed at prototype scale — do not
  introduce Redux/Zustand unless complexity clearly demands it.
- **Naming:** `camelCase` for variables/functions, `PascalCase` for
  components/types/interfaces, `SCREAMING_SNAKE_CASE` for env-derived
  constants. Prefix boolean variables with `is`/`has`/`should`.
- **File naming:** `PascalCase.tsx` for components, `camelCase.ts` for
  utilities/hooks.
- **Async/error handling:** every `ethers` call and `fetch` wrapped in
  try/catch, errors normalized to a shared `AppError` shape before hitting
  the UI (never render raw `error.message` from `ethers` directly — it's
  often unreadable JSON-RPC noise).
- **No magic numbers/strings:** chain IDs, gateway URLs, contract
  addresses live in a single `src/config.ts`, sourced from environment
  variables (`import.meta.env.VITE_*`).

## 5. Styling

- TailwindCSS utility classes; no inline `style={{}}` except for values
  computed at runtime (e.g. dynamic preview positioning).
- Shared design tokens (colors, spacing) defined once in
  `tailwind.config.ts`, not hardcoded per-component.
- Certificate preview component must render identically in three contexts
  (live editor preview, recipient view, PDF/PNG export) — implement it once
  and reuse, do not fork the markup.

## 6. Naming Conventions Summary

| Element | Convention | Example |
|---|---|---|
| Solidity contract | `PascalCase` | `CertificateRegistry` |
| Solidity function | `mixedCase` | `issueCertificate` |
| Solidity event | `PascalCase` | `CertificateIssued` |
| Solidity constant | `UPPER_SNAKE_CASE` | `MAX_BATCH_SIZE` |
| TS component | `PascalCase.tsx` | `VerificationResult.tsx` |
| TS hook | `useCamelCase.ts` | `useCertificateRegistry.ts` |
| TS interface/type | `PascalCase` | `CertificateMetadata` |
| Env var | `VITE_SCREAMING_SNAKE_CASE` | `VITE_REGISTRY_ADDRESS` |

## 7. Git & Commit Conventions

- **Conventional Commits:** `feat:`, `fix:`, `test:`, `docs:`, `chore:`,
  `refactor:` prefixes.
- One logical change per commit; contract changes and frontend changes
  committed separately when both are touched in the same task.
- Branch naming: `feature/<short-desc>`, `fix/<short-desc>`.

## 8. Testing Standards

- **Contracts:** Hardhat/Chai (or Foundry) — target ≥90% branch coverage;
  run `coverage` as part of CI/build loop.
- **Frontend:** Vitest + React Testing Library for hooks/components with
  logic (hashing utility, canonicalization utility, verification
  tri-state renderer are mandatory unit-test targets). E2E smoke test
  (Playwright, optional) for the full issue → verify flow against a local
  Hardhat node is encouraged but not blocking for prototype.

## 9. Documentation Standards

- `README.md` at repo root: setup instructions, env vars required, how to
  run local Hardhat node + deploy + run frontend.
- Every module in `frontend/src/lib/` gets a top-of-file comment
  explaining its single responsibility.
- The canonicalization/hashing algorithm gets its own short doc
  (`docs/HASHING.md` or a prominent comment block) since third parties
  must be able to reproduce it independently to trust the system.

## 10. Security Checklist (apply before considering any module "done")

- [ ] No secret keys committed or shipped in the frontend bundle.
- [ ] All Solidity state-mutating functions have access control.
- [ ] Custom errors used, no string-based `require`.
- [ ] Contract compiled with no compiler warnings.
- [ ] Frontend validates/sanitizes all user-entered text before it enters
      the hashed payload or is rendered (avoid XSS via certificate fields).
- [ ] IPFS-fetched content is treated as untrusted input when rendered.
