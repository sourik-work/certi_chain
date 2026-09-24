# CertiChain Ledger

**CertiChain Ledger** is a decentralized credential issuance, verification, and lifecycle-management system anchored to EVM smart contracts, SHA-256 cryptographic proof hashes, and decentralized IPFS storage.

---

## Architecture Overview

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
        |  (CertificateRegistry)   |                        |  (RFC 8785 Canonicalizer|
        |                          |                        |   & Serverless Proxy)    |
        +--------------------------+                        +--------------------------+
        | - Packed 4-slot struct   |                        | - JCS UTF-16 Code Sort   |
        | - Custom Errors          |                        | - Browser SubtleCrypto   |
        | - Ownable2Step & Pausable|                        | - Pinata /api/pinJson    |
        | - 3-indexed Event Logs   |                        | - Fallback IPFS Gateway  |
        +--------------------------+                        +--------------------------+
```

---

## Monorepo Structure

```
certichain-ledger/
├── contracts/
│   ├── src/
│   │   └── CertificateRegistry.sol     # Core EVM registry (Solidity 0.8.24)
│   ├── test/
│   │   └── CertificateRegistry.test.ts # Hardhat/Chai tests (100% branch coverage)
│   ├── scripts/
│   │   ├── deploy.ts                   # Deployment script (Local & Sepolia)
│   │   └── verify.ts                   # Etherscan verification script
│   ├── hardhat.config.ts
│   └── package.json
├── frontend/
│   ├── api/
│   │   └── pinJson.ts                  # Serverless Pinata proxy (NFR-1 secret isolation)
│   ├── src/
│   │   ├── components/                 # CertificatePreview, Navbar, NetworkGuard, TransactionStatus, VerificationResult
│   │   ├── hooks/                      # useWallet, useCertificateRegistry, useToast
│   │   ├── lib/                        # canonicalize.ts, hash.ts, validateMetadata.ts, pinata.ts, verify.ts, export.ts
│   │   ├── pages/                      # IssuerDashboard, RecipientDashboard, VerifyCertificate
│   │   ├── context/                    # WalletContext, ToastContext
│   │   ├── types/                      # TypeScript schemas and error definitions
│   │   ├── contracts/                  # TypeChain generated contract typings
│   │   ├── config.ts                   # Environment variables configuration
│   │   └── App.tsx
│   └── package.json
├── docs/
│   ├── PROJECT_REQUIREMENTS.md         # Requirements specification
│   ├── CONVENTIONS.md                  # Coding standards and design patterns
│   ├── HASHING.md                      # Canonicalization and hashing algorithm
│   └── PROGRESS.md                     # Traceability matrix and build evidence
├── GEMINI.md                           # Build loop rules
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js `v20+` or `v24+`
- npm `v10+`

### 1. Install Dependencies
From the repository root:
```bash
npm install
```

### 2. Configure Environment Variables

#### Contracts (`contracts/.env`):
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

#### Frontend (`frontend/.env`):
```env
VITE_CHAIN_ID=31337
VITE_REGISTRY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
VITE_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
VITE_IPFS_FALLBACK_GATEWAY=https://ipfs.io/ipfs/
```

#### Serverless IPFS Proxy (`PINATA_JWT`):
In your hosting deployment environment (e.g. Vercel / Netlify environment settings), configure:
```env
PINATA_JWT=eyJhbGciOi...
```

---

## Running Locally

### Step 1: Start Hardhat Node
```bash
cd contracts
npx hardhat node
```

### Step 2: Deploy Smart Contract
In another terminal:
```bash
npm --workspace=contracts run deploy:local
```
This automatically updates `frontend/.env` with the deployed `VITE_REGISTRY_ADDRESS`.

### Step 3: Run Frontend Development Server
```bash
npm --workspace=frontend run dev
```
Open `http://localhost:5173` in your browser.

---

## Running Automated Tests & Coverage

### Smart Contract Test Suite & Coverage
```bash
# Run unit tests
npm --workspace=contracts run test

# Run branch coverage report (>=90% target, achieves 100%)
npm --workspace=contracts run coverage
```

### Frontend Test Suite (Vitest)
```bash
npm --workspace=frontend run test
```

### Production Build Validation
```bash
npm --workspace=frontend run build
```

---

## Key Features

1. **Deterministic Canonicalization (RFC 8785)**: Deterministically sorts all object keys in UTF-16 code unit order, excluding self-referential `issuedProofHash`. Documented with worked example in `docs/HASHING.md`.
2. **Tri-State Public Verification**: Public `/verify/:certId` route resolving **VALID**, **REVOKED**, or **INVALID/TAMPERED** status without requiring a connected wallet.
3. **Gas-Optimized Storage**: Struct packed into 4 slots in `CertificateRegistry.sol` using `uint64` timestamps and custom Solidity errors.
4. **Client-Side Asset Export**: High-resolution PNG (≥1920px) and print-ready A4 PDF exports with embedded scannable verification QR codes.
5. **No Secrets in Client Bundle**: Serverless proxy (`/api/pinJson`) isolates the Pinata JWT from browser code.
