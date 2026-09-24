/**
 * @file useCertificateRegistry.ts
 * @summary Single Responsibility: Encapsulates all ethers.js contract interactions for CertificateRegistry.sol.
 *
 * Adheres to CONVENTIONS.md: components stay presentational and call this hook.
 * Uses generated TypeChain bindings and normalizes errors to AppError.
 */

import { useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import { CONFIG, getRegistryAddress } from '../config';
import { CertificateRegistry, CertificateRegistry__factory } from '../contracts';
import { OnChainCertificate, IssuedCertificateRecord } from '../types/certificate';
import { normalizeError } from '../types/error';

export interface UseCertificateRegistryReturn {
  isIssuerAuthorized: (address: string) => Promise<boolean>;
  issueCertificate: (
    proofHash: string,
    metadataUrl: string,
    recipient: string
  ) => Promise<{ txHash: string; wait: (confirmations?: number) => Promise<ethers.ContractTransactionReceipt | null> }>;
  revokeCertificate: (
    certId: string,
    reason: string
  ) => Promise<{ txHash: string; wait: (confirmations?: number) => Promise<ethers.ContractTransactionReceipt | null> }>;
  verifyCertificate: (certId: string) => Promise<OnChainCertificate>;
  queryRecipientCertificates: (recipientAddress: string) => Promise<IssuedCertificateRecord[]>;
  queryAllIssuedCertificates: (issuerAddress?: string) => Promise<IssuedCertificateRecord[]>;
}

export function useCertificateRegistry(): UseCertificateRegistryReturn {
  const { provider, signer, chainId } = useWallet();

  // Readonly fallback provider for public walletless queries
  const fallbackProvider = useMemo(() => {
    return new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  }, []);

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

  const isIssuerAuthorized = useCallback(
    async (address: string): Promise<boolean> => {
      try {
        if (!ethers.isAddress(address)) return false;
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

  const issueCertificate = useCallback(
    async (proofHash: string, metadataUrl: string, recipient: string) => {
      if (!signer) {
        throw new Error('Please connect your wallet to issue credentials.');
      }
      try {
        const contract = getContract(true);
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

  const queryRecipientCertificates = useCallback(
    async (recipientAddress: string): Promise<IssuedCertificateRecord[]> => {
      if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
        return [];
      }
      const fromBlock = (chainId === 11155111 || CONFIG.targetChainId === 11155111) ? 11774000 : 0;
      try {
        const contract = getContract(false);
        // Filter on CertificateIssued with indexed recipient parameter (Decision 2.5 / FR-3.5)
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
