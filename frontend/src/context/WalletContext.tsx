/**
 * @file WalletContext.tsx
 * @summary Global Web3 Wallet Provider & State Management.
 * 
 * Core Features:
 * 1. Manages connection to MetaMask and EIP-1193 injected Web3 providers.
 * 2. Provides developer account simulation for instant testing on local Hardhat nodes.
 * 3. Listens to `accountsChanged` and `chainChanged` events to maintain synchronized UI state.
 * 4. Provides programmatic network switching (`wallet_switchEthereumChain` / `wallet_addEthereumChain`).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONFIG } from '../config';

/**
 * Interface representing standard EIP-1193 Ethereum provider in the window object.
 */
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/**
 * Structure representing a pre-funded local Hardhat developer test account.
 */
export interface DevAccountOption {
  label: string;
  address: string;
  role: 'issuer' | 'recipient' | 'general';
  description: string;
}

/**
 * Pre-funded accounts available when developing locally against Hardhat node.
 */
export const DEV_ACCOUNTS: DevAccountOption[] = [
  {
    label: 'Deployer & Authorized Issuer',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    role: 'issuer',
    description: 'Contract owner, pre-authorized to issue credentials (10,000 ETH)',
  },
  {
    label: 'Alice Nakamoto (Recipient)',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    role: 'recipient',
    description: 'Demo recipient account (10,000 ETH)',
  },
  {
    label: 'Bob Verifier / Holder',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    role: 'general',
    description: 'Secondary test account (10,000 ETH)',
  },
];

/**
 * Interface defining the reactive state and methods exposed by WalletContext.
 */
export interface WalletContextState {
  account: string | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null;
  signer: ethers.JsonRpcSigner | null;
  isConnecting: boolean;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  isDevAccount: boolean;
  hasInjectedWallet: boolean;
  error: string | null;
  connect: () => Promise<void>;
  connectDevAccount: (address: string) => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextState | null>(null);

/**
 * React Context Provider that wraps the entire application to supply wallet state.
 */
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | ethers.JsonRpcProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isDevAccount, setIsDevAccount] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Checks if user's browser has an injected Web3 provider (like MetaMask extension)
  const hasInjectedWallet = typeof window !== 'undefined' && !!window.ethereum;
  const isConnected = !!account && !!signer;
  
  // Checks if the connected network is Sepolia (11155111), Localhost (31337), or targetChainId
  const isCorrectNetwork = chainId === 11155111 || chainId === 31337 || chainId === CONFIG.targetChainId;

  /**
   * Helper function to refresh active account, signer, and chainId from the provider.
   */
  const updateWalletState = useCallback(async (ethProvider: ethers.BrowserProvider) => {
    try {
      const network = await ethProvider.getNetwork();
      const currentChainId = Number(network.chainId);
      setChainId(currentChainId);

      const accounts = await ethProvider.listAccounts();
      if (accounts.length > 0) {
        const primarySigner = await ethProvider.getSigner();
        setAccount(accounts[0].address);
        setSigner(primarySigner);
      } else {
        setAccount(null);
        setSigner(null);
      }
    } catch (err) {
      console.error('Failed to update wallet state:', err);
      setAccount(null);
      setSigner(null);
    }
  }, []);

  /**
   * Requests connection to user's injected browser wallet (MetaMask).
   */
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask or Web3 wallet is not installed. Please install a Web3 wallet extension.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      setProvider(browserProvider);
      setIsDevAccount(false);

      // Prompt user to select account in MetaMask
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await updateWalletState(browserProvider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [updateWalletState]);

  /**
   * Connects to a simulated local Hardhat test account using JsonRpcProvider.
   */
  const connectDevAccount = useCallback(
    async (devAddress: string) => {
      setIsConnecting(true);
      setError(null);
      try {
        const rpcProvider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
        const network = await rpcProvider.getNetwork();
        setChainId(Number(network.chainId));
        setProvider(rpcProvider);
        const devSigner = await rpcProvider.getSigner(devAddress);
        setAccount(devAddress);
        setSigner(devSigner);
        setIsDevAccount(true);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : `Failed to connect to local dev account at ${CONFIG.rpcUrl}`;
        setError(message);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    []
  );

  /**
   * Resets wallet state and disconnects active session in app memory.
   */
  const disconnect = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setIsDevAccount(false);
    setError(null);
  }, []);

  /**
   * Prompts MetaMask to switch to the configured blockchain network (e.g. Sepolia).
   * If the network is not yet added to the user's wallet, prompts them to add it.
   */
  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;

    const hexChainId = `0x${CONFIG.targetChainId.toString(16)}`;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError: unknown) {
      const switchErr = switchError as { code?: number };
      // Error code 4902 indicates that the network has not been added to MetaMask yet
      if (switchErr.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: CONFIG.targetChainName,
                rpcUrls: [CONFIG.rpcUrl],
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
        }
      } else {
        console.error('Failed to switch network:', switchError);
      }
    }
  }, []);

  /**
   * Effect to initialize provider and subscribe to MetaMask lifecycle events.
   */
  useEffect(() => {
    if (!window.ethereum) return;

    const browserProvider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
    setProvider(browserProvider);

    // Check if user has already granted account access in a previous session
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accs) => {
        const accounts = accs as string[];
        if (accounts.length > 0) {
          updateWalletState(browserProvider);
        }
      })
      .catch((err) => console.error('Error fetching initial accounts:', err));

    // Handle user switching accounts in MetaMask
    const handleAccountsChanged = (accs: unknown) => {
      const accounts = accs as string[];
      if (accounts.length === 0) {
        disconnect();
      } else {
        updateWalletState(browserProvider);
      }
    };

    // Handle user switching blockchain network in MetaMask
    const handleChainChanged = () => {
      updateWalletState(browserProvider);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Clean up event listeners on unmount
    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [disconnect, updateWalletState]);

  return (
    <WalletContext.Provider
      value={{
        account,
        chainId,
        provider,
        signer,
        isConnecting,
        isConnected,
        isCorrectNetwork,
        isDevAccount,
        hasInjectedWallet,
        error,
        connect,
        connectDevAccount,
        disconnect,
        switchNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

/**
 * Custom React hook to consume the WalletContext state across any component.
 */
export const useWallet = (): WalletContextState => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

