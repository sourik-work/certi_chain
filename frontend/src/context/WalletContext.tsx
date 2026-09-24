import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONFIG } from '../config';

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

export interface DevAccountOption {
  label: string;
  address: string;
  role: 'issuer' | 'recipient' | 'general';
  description: string;
}

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

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | ethers.JsonRpcProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isDevAccount, setIsDevAccount] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const hasInjectedWallet = typeof window !== 'undefined' && !!window.ethereum;
  const isConnected = !!account && !!signer;
  const isCorrectNetwork = chainId === 11155111 || chainId === 31337 || chainId === CONFIG.targetChainId;

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

  const disconnect = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setIsDevAccount(false);
    setError(null);
  }, []);

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
      // Chain not added (error code 4902)
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

  useEffect(() => {
    if (!window.ethereum) return;

    const browserProvider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
    setProvider(browserProvider);

    // Initial check for already connected accounts
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accs) => {
        const accounts = accs as string[];
        if (accounts.length > 0) {
          updateWalletState(browserProvider);
        }
      })
      .catch((err) => console.error('Error fetching initial accounts:', err));

    const handleAccountsChanged = (accs: unknown) => {
      const accounts = accs as string[];
      if (accounts.length === 0) {
        disconnect();
      } else {
        updateWalletState(browserProvider);
      }
    };

    const handleChainChanged = () => {
      updateWalletState(browserProvider);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

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

export const useWallet = (): WalletContextState => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
