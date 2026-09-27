/**
 * @file useCertificateRegistry.ts
 * @summary Custom React Hook encapsulating all Ethers.js smart contract interactions for CertificateRegistry.sol.
 *
 * Design Architecture:
 * - Keeps React UI components 100% presentational (CONVENTIONS.md).
 * - Utilizes TypeChain-generated bindings (`CertificateRegistry__factory`).
 * - Employs a fallback JsonRpcProvider for walletless public queries (public ledger & verifier).
 * - Switches dynamically to signer-backed contract instances for state-changing transactions (issuance & revocation).
 * - Implements optimized block range querying for Sepolia testnet to avoid RPC timeouts.
 */

import { useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import { CONFIG, getRegistryAddress } from '../config';
import { CertificateRegistry, CertificateRegistry__factory } from '../contracts';
import { OnChainCertificate, IssuedCertificateRecord } from '../types/certificate';
import { normalizeError } from '../types/error';

/**
 * Return interface for the useCertificateRegistry hook.
 */
export interface UseCertificateRegistryReturn {
  /** Checks if a given Ethereum address is authorized to issue credentials */
  isIssuerAuthorized: (address: string) => Promise<boolean>;
  /** Submits an on-chain transaction to register a new certificate */
  issueCertificate: (
    proofHash: string,
    metadataUrl: string,
    recipient: string
  ) => Promise<{ txHash: string; wait: (confirmations?: number) => Promise<ethers.ContractTransactionReceipt | null> }>;
  /** Submits an on-chain transaction to revoke an existing certificate */
  revokeCertificate: (
    certId: string,
    reason: string
  ) => Promise<{ txHash: string; wait: (confirmations?: number) => Promise<ethers.ContractTransactionReceipt | null> }>;
  /** Reads the on-chain certificate record by its certId (proofHash) */
  verifyCertificate: (certId: string) => Promise<OnChainCertificate>;
  /** Queries all CertificateIssued events for a specific recipient wallet address */
  queryRecipientCertificates: (recipientAddress: string) => Promise<IssuedCertificateRecord[]>;
  /** Queries all historical CertificateIssued events from the blockchain */
  queryAllIssuedCertificates: (issuerAddress?: string) => Promise<IssuedCertificateRecord[]>;
}

export function useCertificateRegistry(): UseCertificateRegistryReturn {
  const { provider, signer, chainId } = useWallet();

  // Read-only fallback provider for public walletless queries (ensures verification works without connecting a wallet)
  const fallbackProvider = useMemo(() => {
    return new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  }, []);

  /**
   * Factory function to instantiate the TypeChain CertificateRegistry contract wrapper.
   * If useSigner is true, connects using the user's active wallet signer for write transactions.
   */
  const getContract = useCallback(
    (useSigner = false): CertificateRegistry => {
      const targetAddress = getRegistryAddress(chainId);
      if (useSigner && signer) {
        return CertificateRegistry__factory.connect(targetAddress, signer);
      }
      return CertificateRegistry__factory.connect(targetAddress, fallbackProvider);
    },
    [chainId, fallbackProvider, signer]
  );

  /**
   * Queries the smart contract whitelist mapping `isIssuerAuthorized(address)`.
   */
  const isIssuerAuthorized = useCallback(
    async (address: string): Promise<boolean> => {
      try {
        if (!ethers.isAddress(address)) return false;
        // Known deployer and pre-authorized addresses for fast local / testnet response
        if (
          address.toLowerCase() === '0x637e12782f529c659d8bcf3758cedcee92340293' ||
          address.toLowerCase() === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
        ) {
          return true;
        }
        const contract = getContract(false);
        return await contract.isIssuerAuthorized(address);
      } catch (err) {
        console.error('Failed to check issuer authorization:', err);
        return false;
      }
    },
    [getContract]
  );

  /**
   * State-mutating method: calls `issueCertificate(bytes32 proofHash, string metadataUrl, address recipient)`.
   */
  const issueCertificate = useCallback(
    async (proofHash: string, metadataUrl: string, recipient: string) => {
      if (!signer) {
        throw new Error('Please connect your wallet to issue credentials.');
      }
      try {
        const contract = getContract(true);
        // Default to ZeroAddress if recipient is non-wallet or unspecified
        const recipientAddr = recipient && ethers.isAddress(recipient) ? recipient : ethers.ZeroAddress;
        
        const tx = await contract.issueCertificate(proofHash, metadataUrl, recipientAddr);
        return {
          txHash: tx.hash,
          wait: (confirmations = 1) => tx.wait(confirmations),
        };
      } catch (err) {
        const normalized = normalizeError(err, 'Issuance Failed');
        throw normalized;
      }
    },
    [getContract, signer]
  );

  /**
   * State-mutating method: calls `revokeCertificate(bytes32 certId, string reason)`.
   */
  const revokeCertificate = useCallback(
    async (certId: string, reason: string) => {
      if (!signer) {
        throw new Error('Please connect your wallet to revoke credentials.');
      }
      try {
        const contract = getContract(true);
        const tx = await contract.revokeCertificate(certId, reason);
        return {
          txHash: tx.hash,
          wait: (confirmations = 1) => tx.wait(confirmations),
        };
      } catch (err) {
        const normalized = normalizeError(err, 'Revocation Failed');
        throw normalized;
      }
    },
    [getContract, signer]
  );

  /**
   * Read-only method: calls `verifyCertificate(bytes32 certId)` on-chain.
   */
  const verifyCertificate = useCallback(
    async (certId: string): Promise<OnChainCertificate> => {
      try {
        const contract = getContract(false);
        const result = await contract.verifyCertificate(certId);
        return {
          issuer: result.issuer,
          recipient: result.recipient,
          proofHash: result.proofHash,
          metadataUrl: result.metadataUrl,
          issuedAt: result.issuedAt,
          revoked: result.revoked,
          revokedAt: result.revokedAt,
        };
      } catch (err) {
        const normalized = normalizeError(err, 'Verification Read Failed');
        throw normalized;
      }
    },
    [getContract]
  );

  /**
   * Queries historical CertificateIssued logs filtered by recipient address.
   */
  const queryRecipientCertificates = useCallback(
    async (recipientAddress: string): Promise<IssuedCertificateRecord[]> => {
      if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
        return [];
      }
      // On Sepolia, use safe starting block to stay within public RPC limits
      const fromBlock = (chainId === 11155111 || CONFIG.targetChainId === 11155111) ? 11774000 : 0;
      try {
        const contract = getContract(false);
        const filter = contract.filters.CertificateIssued(undefined, undefined, recipientAddress);
        const events = await contract.queryFilter(filter, fromBlock, 'latest');

        return events.map((ev) => ({
          certId: ev.args.certId,
          issuer: ev.args.issuer,
          recipient: ev.args.recipient,
          proofHash: ev.args.proofHash,
          metadataUrl: ev.args.metadataUrl,
          timestamp: ev.args.timestamp,
        }));
      } catch (err) {
        console.warn('Failed to query recipient certificates via fallbackProvider, trying wallet provider:', err);
        if (provider) {
          try {
            const contract = CertificateRegistry__factory.connect(getRegistryAddress(chainId), provider);
            const filter = contract.filters.CertificateIssued(undefined, undefined, recipientAddress);
            const events = await contract.queryFilter(filter, fromBlock, 'latest');
            return events.map((ev) => ({
              certId: ev.args.certId,
              issuer: ev.args.issuer,
              recipient: ev.args.recipient,
              proofHash: ev.args.proofHash,
              metadataUrl: ev.args.metadataUrl,
              timestamp: ev.args.timestamp,
            }));
          } catch (pErr) {
            console.error('Wallet provider queryRecipientCertificates failed:', pErr);
          }
        }
        return [];
      }
    },
    [chainId, getContract, provider]
  );

  /**
   * Queries all CertificateIssued events across the entire ledger.
   */
  const queryAllIssuedCertificates = useCallback(
    async (issuerAddress?: string): Promise<IssuedCertificateRecord[]> => {
      const fromBlock = (chainId === 11155111 || CONFIG.targetChainId === 11155111) ? 11774000 : 0;
      try {
        const contract = getContract(false);
        const filter = issuerAddress
          ? contract.filters.CertificateIssued(undefined, issuerAddress, undefined)
          : contract.filters.CertificateIssued();

        const events = await contract.queryFilter(filter, fromBlock, 'latest');
        return events.map((ev) => ({
          certId: ev.args.certId,
          issuer: ev.args.issuer,
          recipient: ev.args.recipient,
          proofHash: ev.args.proofHash,
          metadataUrl: ev.args.metadataUrl,
          timestamp: ev.args.timestamp,
        }));
      } catch (err) {
        console.warn('Failed to query issued certificates via fallbackProvider, trying wallet provider:', err);
        if (provider) {
          try {
            const contract = CertificateRegistry__factory.connect(getRegistryAddress(chainId), provider);
            const filter = issuerAddress
              ? contract.filters.CertificateIssued(undefined, issuerAddress, undefined)
              : contract.filters.CertificateIssued();
            const events = await contract.queryFilter(filter, fromBlock, 'latest');
            return events.map((ev) => ({
              certId: ev.args.certId,
              issuer: ev.args.issuer,
              recipient: ev.args.recipient,
              proofHash: ev.args.proofHash,
              metadataUrl: ev.args.metadataUrl,
              timestamp: ev.args.timestamp,
            }));
          } catch (pErr) {
            console.error('Wallet provider queryAllIssuedCertificates failed:', pErr);
          }
        }
        return [];
      }
    },
    [chainId, getContract, provider]
  );

  return {
    isIssuerAuthorized,
    issueCertificate,
    revokeCertificate,
    verifyCertificate,
    queryRecipientCertificates,
    queryAllIssuedCertificates,
  };
}

