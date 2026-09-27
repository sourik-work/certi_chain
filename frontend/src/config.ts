/**
 * @file config.ts
 * @summary Centralized Application Configuration & Network Environment Resolution.
 * 
 * Architectural Role:
 * - Serves as the single source of truth for target chain IDs, RPC URLs, deployed contract addresses, and IPFS gateways.
 * - Dynamically detects production deployments (Vercel) vs local development environments.
 * - Prevents contract mismatch by falling back to verified Sepolia contract when deployed on live URLs.
 */

export interface AppConfig {
  /** Target EVM Chain ID (e.g., 11155111 for Ethereum Sepolia, 31337 for Hardhat Node) */
  readonly targetChainId: number;
  /** Human-readable name of the blockchain network */
  readonly targetChainName: string;
  /** JSON-RPC endpoint URL for fallback read-only calls (walletless state inspection) */
  readonly rpcUrl: string;
  /** Ethereum address of the deployed CertificateRegistry contract */
  readonly registryAddress: string;
  /** Primary dedicated or public Pinata IPFS gateway prefix */
  readonly pinataGateway: string;
  /** Secondary public IPFS gateway prefix used if the primary gateway fails or rate-limits */
  readonly fallbackGateway: string;
}

// Check if running on Vercel preview or production domain
const isVercelHost = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

// Read user-defined chain ID from Vite environment or default to Sepolia (11155111)
const envChainId = Number(import.meta.env.VITE_CHAIN_ID);
const targetChainId = isVercelHost ? 11155111 : (envChainId || 11155111);

// Default canonical deployed contract addresses:
// - Sepolia: Verified live contract
// - Localhost: Standard Hardhat default address
const defaultRegistry = targetChainId === 11155111
  ? '0xeCBA3CDA5f34859744ACe79B7BA79B71cC29580D'
  : '0x5FbDB2315678afecb367f032d93F642f64180aa3';

/**
 * Immutable global application configuration object.
 */
export const CONFIG: AppConfig = {
  targetChainId,
  targetChainName: targetChainId === 11155111 ? 'Sepolia Testnet' : 'Hardhat Localhost',
  rpcUrl: targetChainId === 11155111 ? 'https://ethereum-sepolia-rpc.publicnode.com' : 'http://127.0.0.1:8545',
  registryAddress: (isVercelHost && import.meta.env.VITE_REGISTRY_ADDRESS?.startsWith('0x5FbDB'))
    ? defaultRegistry
    : (import.meta.env.VITE_REGISTRY_ADDRESS || defaultRegistry),
  pinataGateway: import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
  fallbackGateway: import.meta.env.VITE_IPFS_FALLBACK_GATEWAY || 'https://ipfs.io/ipfs/',
};

/**
 * Resolves the appropriate contract address depending on the currently connected wallet's chainId.
 * @param currentChainId - Chain ID returned by the connected wallet provider.
 * @returns The corresponding contract address string.
 */
export function getRegistryAddress(currentChainId?: number | null): string {
  if (currentChainId === 31337) {
    return '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  }
  return '0xeCBA3CDA5f34859744ACe79B7BA79B71cC29580D';
}

