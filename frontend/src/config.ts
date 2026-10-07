/**
 * Application Configuration
 * Single source of truth for network IDs, per-chain contract addresses, RPC providers, and IPFS gateways.
 * Adheres strictly to CONVENTIONS.md and multi-network verification requirements.
 */

import { ethers } from 'ethers';

export interface ChainDetails {
  readonly chainId: number;
  readonly name: string;
  readonly rpcUrls: readonly string[];
  readonly defaultRegistryAddress: string;
  readonly blockExplorerUrl: string;
}

export const SUPPORTED_CHAINS: Record<number, ChainDetails> = {
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrls: [
      'https://1rpc.io/sepolia',
      'https://sepolia.drpc.org',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.gateway.tenderly.co',
      'https://rpc.sepolia.org',
    ],
    defaultRegistryAddress: '0xeCBA3CDA5f34859744ACe79B7BA79B71cC29580D',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
  },
  31337: {
    chainId: 31337,
    name: 'Hardhat Localhost',
    rpcUrls: ['http://127.0.0.1:8545'],
    defaultRegistryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    blockExplorerUrl: '',
  },
};

const isVercelHost = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export function getDefaultChainId(): number {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEFAULT_CHAIN_ID) {
    const parsed = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID);
    if (!isNaN(parsed) && SUPPORTED_CHAINS[parsed]) return parsed;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CHAIN_ID) {
    const parsed = Number(import.meta.env.VITE_CHAIN_ID);
    if (!isNaN(parsed) && SUPPORTED_CHAINS[parsed]) return parsed;
  }
  if (isVercelHost) return 11155111;
  if (isLocalhost) return 31337;
  return 11155111;
}

/**
 * Returns the verified registry contract address for a specific chain.
 * Env overrides are strictly chain-scoped (e.g. VITE_REGISTRY_ADDRESS_31337, VITE_REGISTRY_ADDRESS_11155111).
 */
export function getRegistryAddress(chainId?: number | null): string {
  const targetId = chainId || getDefaultChainId();
  const envKey = `VITE_REGISTRY_ADDRESS_${targetId}`;
  
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[envKey]) {
    return import.meta.env[envKey];
  }

  const chain = SUPPORTED_CHAINS[targetId];
  if (!chain) {
    throw new Error(`Unsupported network chain ID: ${targetId}. Supported chains: ${Object.keys(SUPPORTED_CHAINS).join(', ')}`);
  }

  return chain.defaultRegistryAddress;
}

/**
 * Returns the chain specification or undefined for unknown chain IDs.
 */
export function getChainDetails(chainId?: number | null): ChainDetails {
  const targetId = chainId || getDefaultChainId();
  return SUPPORTED_CHAINS[targetId] || {
    chainId: targetId,
    name: `Unknown Chain (${targetId})`,
    rpcUrls: [],
    defaultRegistryAddress: '',
    blockExplorerUrl: '',
  };
}

/**
 * Creates an ethers JsonRpcProvider for a specific chain with fallback capabilities.
 */
export function getReadProvider(chainId?: number | null): ethers.JsonRpcProvider {
  const targetId = chainId || getDefaultChainId();
  const chain = getChainDetails(targetId);

  if (chain.rpcUrls.length === 0) {
    return new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  }

  // Use primary RPC URL
  return new ethers.JsonRpcProvider(chain.rpcUrls[0], {
    chainId: chain.chainId,
    name: chain.name,
  });
}

/**
 * Checks whether a smart contract is deployed at the registry address on the specified chain.
 */
export async function checkContractExists(
  chainId?: number | null,
  providerOverride?: ethers.Provider
): Promise<{ exists: boolean; codeLength: number; address: string; chainName: string }> {
  const targetId = chainId || getDefaultChainId();
  const address = getRegistryAddress(targetId);
  const chain = getChainDetails(targetId);
  const provider = providerOverride || getReadProvider(targetId);

  try {
    const code = await provider.getCode(address);
    const codeLength = (code.length - 2) / 2;
    return {
      exists: codeLength > 0,
      codeLength,
      address,
      chainName: chain.name,
    };
  } catch (err) {
    return {
      exists: false,
      codeLength: 0,
      address,
      chainName: chain.name,
    };
  }
}

/**
 * Normalizes user input certId or pasted verify URL into standard 0x-prefixed 32-byte lowercase hex.
 */
export function normalizeCertId(rawInput: string): { valid: boolean; certId: string; chainId?: number; error?: string } {
  if (!rawInput || !rawInput.trim()) {
    return { valid: false, certId: '', error: 'Certificate ID cannot be empty.' };
  }

  let cleaned = rawInput.trim();
  let extractedChainId: number | undefined = undefined;

  // Handle pasted URL
  if (cleaned.includes('/verify/')) {
    try {
      const urlObj = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
      const pathParts = urlObj.pathname.split('/verify/');
      if (pathParts.length > 1) {
        cleaned = pathParts[1].split('/')[0];
      }
      const chainParam = urlObj.searchParams.get('chain');
      if (chainParam) {
        const parsed = Number(chainParam);
        if (!isNaN(parsed)) extractedChainId = parsed;
      }
    } catch {
      const match = cleaned.match(/\/verify\/([^/?#]+)/);
      if (match) cleaned = match[1];
    }
  }

  // Handle glued chain parameter or standard query params
  const chainMatch = cleaned.match(/[?&#]chain=(\d+)|(?<=0x[0-9a-fA-F]{64})[^\s0-9a-fA-F]*chain=(\d+)|chain=(\d+)/i);
  if (chainMatch) {
    const parsed = Number(chainMatch[1] || chainMatch[2] || chainMatch[3]);
    if (!isNaN(parsed) && parsed > 0) {
      extractedChainId = parsed;
    }
  }

  // Remove any query params, glued chain suffixes, or hash if present
  cleaned = cleaned.replace(/[?&#].*$/, '').replace(/(?<=0x[0-9a-fA-F]{64}).*$/, '');

  // Strip trailing slashes or delimiters
  cleaned = cleaned.replace(/[/\\?&#]+$/, '').trim().toLowerCase();

  // If a 64-character hex hash is embedded in the string, extract the 0x prefix + 64 hex characters
  const hexHashMatch = cleaned.match(/(?:0x)?[0-9a-f]{64}/i);
  if (hexHashMatch) {
    cleaned = hexHashMatch[0].toLowerCase();
  }

  if (!cleaned.startsWith('0x')) {
    cleaned = `0x${cleaned}`;
  }

  const hexRegex = /^0x[0-9a-f]{64}$/;
  if (!hexRegex.test(cleaned)) {
    return {
      valid: false,
      certId: cleaned,
      error: `Invalid Certificate ID format: Must be a 32-byte hexadecimal hash (66 characters beginning with 0x). Received ${cleaned.length} characters.`,
    };
  }

  return { valid: true, certId: cleaned, chainId: extractedChainId || CONFIG.targetChainId };
}

export const extractCertIdAndChain = normalizeCertId;

export interface AppConfig {
  readonly targetChainId: number;
  readonly targetChainName: string;
  readonly rpcUrl: string;
  readonly registryAddress: string;
  readonly pinataGateway: string;
  readonly fallbackGateway: string;
}

const defaultTargetChainId = getDefaultChainId();
const defaultChainDetails = getChainDetails(defaultTargetChainId);

export const CONFIG: AppConfig = {
  targetChainId: defaultTargetChainId,
  targetChainName: defaultChainDetails.name,
  rpcUrl: isLocalhost ? 'http://127.0.0.1:8545' : (defaultChainDetails.rpcUrls[0] || 'https://ethereum-sepolia-rpc.publicnode.com'),
  registryAddress: getRegistryAddress(defaultTargetChainId),
  pinataGateway: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PINATA_GATEWAY) || 'https://gateway.pinata.cloud/ipfs/',
  fallbackGateway: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_IPFS_FALLBACK_GATEWAY) || 'https://ipfs.io/ipfs/',
};

