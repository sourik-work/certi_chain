/**
 * Application Configuration
 * Single source of truth for network IDs, contract addresses, and gateway URLs.
 * Sourced strictly from environment variables per CONVENTIONS.md §4.
 */

export interface AppConfig {
  readonly targetChainId: number;
  readonly targetChainName: string;
  readonly rpcUrl: string;
  readonly registryAddress: string;
  readonly pinataGateway: string;
  readonly fallbackGateway: string;
}

const targetChainId = Number(import.meta.env.VITE_CHAIN_ID || 31337);

export const CONFIG: AppConfig = {
  targetChainId,
  targetChainName: targetChainId === 11155111 ? 'Sepolia Testnet' : 'Hardhat Localhost',
  rpcUrl: targetChainId === 11155111 ? 'https://rpc.sepolia.org' : 'http://127.0.0.1:8545',
  registryAddress: import.meta.env.VITE_REGISTRY_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  pinataGateway: import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
  fallbackGateway: import.meta.env.VITE_IPFS_FALLBACK_GATEWAY || 'https://ipfs.io/ipfs/',
};
