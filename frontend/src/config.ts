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

const targetChainId = Number(import.meta.env.VITE_CHAIN_ID || 11155111);

export const CONFIG: AppConfig = {
  targetChainId,
  targetChainName: targetChainId === 11155111 ? 'Sepolia Testnet' : 'Hardhat Localhost',
  rpcUrl: targetChainId === 11155111 ? 'https://ethereum-sepolia-rpc.publicnode.com' : 'http://127.0.0.1:8545',
  registryAddress: import.meta.env.VITE_REGISTRY_ADDRESS || (targetChainId === 11155111 ? '0xeCBA3CDA5f34859744ACe79B7BA79B71cC29580D' : '0x5FbDB2315678afecb367f032d93F642f64180aa3'),
  pinataGateway: import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
  fallbackGateway: import.meta.env.VITE_IPFS_FALLBACK_GATEWAY || 'https://ipfs.io/ipfs/',
};

export function getRegistryAddress(currentChainId?: number | null): string {
  if (currentChainId === 11155111) {
    return '0xeCBA3CDA5f34859744ACe79B7BA79B71cC29580D';
  }
  if (currentChainId === 31337) {
    return '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  }
  return CONFIG.registryAddress;
}
