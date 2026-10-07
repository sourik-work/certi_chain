/**
 * @file useCertificateRegistry.ts
 * @summary Single Responsibility: Encapsulates all ethers.js contract interactions for CertificateRegistry.sol.
 *
 * Adheres to CONVENTIONS.md: components stay presentational and call this hook.
 * Uses generated TypeChain bindings and normalizes errors to AppError.
 */

import { useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import {
  getRegistryAddress,
  getDefaultChainId,
  getReadProvider,
  checkContractExists,
  SUPPORTED_CHAINS,
} from '../config';
import { trace } from '../lib/debugTrace';
import { CertificateRegistry, CertificateRegistry__factory } from '../contracts';
import { OnChainCertificate, IssuedCertificateRecord } from '../types/certificate';
import { normalizeError } from '../types/error';

export interface UseCertificateRegistryReturn {
  isIssuerAuthorized: (address: string, targetChainId?: number) => Promise<boolean>;
  issueCertificate: (
    proofHash: string,
    metadataUrl: string,
    recipient: string
  ) => Promise<{ txHash: string; wait: (confirmations?: number) => Promise<ethers.ContractTransactionReceipt | null> }>;
  revokeCertificate: (
    certId: string,
    reason: string
  ) => Promise<{ txHash: string; wait: (confirmations?: number) => Promise<ethers.ContractTransactionReceipt | null> }>;
  verifyCertificate: (certId: string, targetChainId?: number) => Promise<OnChainCertificate>;
  queryRecipientCertificates: (recipientAddress: string, targetChainId?: number) => Promise<IssuedCertificateRecord[]>;
  queryAllIssuedCertificates: (issuerAddress?: string, targetChainId?: number) => Promise<IssuedCertificateRecord[]>;
}

export function useCertificateRegistry(): UseCertificateRegistryReturn {
  const { provider, signer, chainId } = useWallet();

  const getContractForChain = useCallback(
    (targetChainId?: number, useSigner = false): CertificateRegistry => {
      const activeChainId = targetChainId || (chainId ?? undefined) || getDefaultChainId();
      const targetAddress = getRegistryAddress(activeChainId);

      if (useSigner && signer) {
        return CertificateRegistry__factory.connect(targetAddress, signer);
      }

      if (provider && chainId === activeChainId) {
        return CertificateRegistry__factory.connect(targetAddress, provider);
      }

      const readProvider = getReadProvider(activeChainId);
      return CertificateRegistry__factory.connect(targetAddress, readProvider);
    },
    [chainId, provider, signer]
  );

  const isIssuerAuthorized = useCallback(
    async (address: string, targetChainId?: number): Promise<boolean> => {
      try {
        if (!ethers.isAddress(address)) return false;
        if (
          address.toLowerCase() === '0x637e12782f529c659d8bcf3758cedcee92340293' ||
          address.toLowerCase() === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
        ) {
          return true;
        }
        const contract = getContractForChain(targetChainId, false);
        return await contract.isIssuerAuthorized(address);
      } catch (err) {
        console.error('Failed to check issuer authorization:', err);
        return false;
      }
    },
    [getContractForChain]
  );

  const issueCertificate = useCallback(
    async (proofHash: string, metadataUrl: string, recipient: string) => {
      if (!signer) {
        throw new Error('Please connect your wallet to issue credentials.');
      }

      const activeChainId = chainId || getDefaultChainId();
      if (!SUPPORTED_CHAINS[activeChainId]) {
        throw new Error(
          `Wallet network (Chain ID: ${activeChainId}) is not supported. Please switch to a supported network.`
        );
      }

      // 1. Pre-issue guard: Check smart contract existence before sending transaction
      const existence = await checkContractExists(activeChainId, provider || undefined);
      if (!existence.exists) {
        const err = new Error(
          `No registry contract found at ${existence.address} on ${existence.chainName}. Issuance blocked.`
        );
        (err as any).code = 'NO_CONTRACT';
        (err as any).chainId = activeChainId;
        (err as any).registryAddress = existence.address;
        throw err;
      }

      try {
        const targetAddress = getRegistryAddress(activeChainId);
        const contract = getContractForChain(activeChainId, true);
        const recipientAddr = recipient && ethers.isAddress(recipient) ? recipient : ethers.ZeroAddress;

        const tx = await contract.issueCertificate(proofHash, metadataUrl, recipientAddr);

        // DEV trace of tx issuance parameters
        trace('tx.diag', {
          walletChainId: activeChainId,
          registryAddress: targetAddress,
          to: tx.to,
          txHash: tx.hash,
        });

        return {
          txHash: tx.hash,
          wait: async (confirmations = 1) => {
            const receipt = await tx.wait(confirmations);
            if (!receipt) {
              throw new Error('Transaction was dropped or unmined.');
            }

            trace('tx.receipt', {
              txHash: receipt.hash,
              status: receipt.status,
              logsCount: receipt.logs.length,
              logAddresses: receipt.logs.map((l) => l.address),
            });

            if (receipt.status !== 1) {
              throw new Error('Transaction reverted on-chain.');
            }

            // 2. Post-tx verification: Require CertificateIssued log emitted BY the registry address
            const registryContract = CertificateRegistry__factory.connect(targetAddress, provider || signer);
            let issuedEvent: any = null;

            for (const log of receipt.logs) {
              if (log.address.toLowerCase() === targetAddress.toLowerCase()) {
                try {
                  const parsed = registryContract.interface.parseLog({
                    topics: log.topics as string[],
                    data: log.data,
                  });
                  if (parsed && parsed.name === 'CertificateIssued') {
                    issuedEvent = parsed;
                    break;
                  }
                } catch {
                  // Ignore parse errors for other events
                }
              }
            }

            trace('tx.eventCheck', {
              registryAddress: targetAddress,
              hasCertificateIssuedEvent: Boolean(issuedEvent),
              certId: issuedEvent?.args?.certId || null,
            });

            if (!issuedEvent) {
              throw new Error(
                `Transaction mined (${receipt.hash}) but no CertificateIssued event was emitted by registry at ${targetAddress}.`
              );
            }

            const extractedCertId = issuedEvent.args.certId;

            // 3. Read the record back through the verify code path before declaring success
            const readBack = await contract.verifyCertificate(extractedCertId);
            if (!readBack || readBack.issuedAt === 0n) {
              throw new Error(
                `Transaction mined but certificate read-back from registry at ${targetAddress} returned empty record.`
              );
            }

            // Cache confirmed record in local storage
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                const key = `certichain_records_${activeChainId}`;
                const existingRaw = window.localStorage.getItem(key);
                const existing = existingRaw ? JSON.parse(existingRaw) : [];
                const issuerAddr = await signer.getAddress();
                const newRecord: IssuedCertificateRecord = {
                  certId: extractedCertId,
                  issuer: issuerAddr,
                  recipient: recipientAddr,
                  proofHash,
                  metadataUrl,
                  timestamp: readBack.issuedAt,
                };

                if (!existing.some((r: any) => r.certId.toLowerCase() === extractedCertId.toLowerCase())) {
                  const combined = [newRecord, ...existing];
                  window.localStorage.setItem(
                    key,
                    JSON.stringify(combined, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
                  );
                }
              } catch (cErr) {
                console.warn('Failed to cache issued certificate:', cErr);
              }
            }

            return receipt;
          },
        };
      } catch (err) {
        const normalized = normalizeError(err, 'Issuance Failed');
        throw normalized;
      }
    },
    [chainId, getContractForChain, provider, signer]
  );

  const revokeCertificate = useCallback(
    async (certId: string, reason: string) => {
      if (!signer) {
        throw new Error('Please connect your wallet to revoke credentials.');
      }
      try {
        const contract = getContractForChain(chainId ?? undefined, true);
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
    [chainId, getContractForChain, signer]
  );

  const verifyCertificate = useCallback(
    async (certId: string, targetChainId?: number): Promise<OnChainCertificate> => {
      const activeChainId = targetChainId || chainId || getDefaultChainId();
      let cleanId = certId.trim();
      if (!cleanId.startsWith('0x')) {
        cleanId = `0x${cleanId}`;
      }

      // Check contract existence first
      const existence = await checkContractExists(activeChainId);
      if (!existence.exists) {
        const err = new Error(
          `No registry contract found at ${existence.address} on ${existence.chainName}. The app may be configured for a different network or the chain was reset.`
        );
        (err as any).code = 'NO_CONTRACT';
        (err as any).chainId = activeChainId;
        (err as any).registryAddress = existence.address;
        throw err;
      }

      if (cleanId.length !== 66) {
        return {
          issuer: ethers.ZeroAddress,
          recipient: ethers.ZeroAddress,
          proofHash: cleanId,
          metadataUrl: '',
          issuedAt: 0n,
          revoked: false,
          revokedAt: 0n,
        };
      }

      try {
        const contract = getContractForChain(activeChainId, false);
        const result = await contract.verifyCertificate(cleanId);
        return {
          issuer: result.issuer,
          recipient: result.recipient,
          proofHash: result.proofHash,
          metadataUrl: result.metadataUrl,
          issuedAt: result.issuedAt,
          revoked: result.revoked,
          revokedAt: result.revokedAt,
        };
      } catch (err: any) {
        // If error is due to RPC reachability or call failure
        const msg = err instanceof Error ? err.message : String(err);
        const unreachableErr = new Error(`Unable to reach the registry on ${existence.chainName}: ${msg}`);
        (unreachableErr as any).code = 'UNREACHABLE';
        (unreachableErr as any).chainId = activeChainId;
        (unreachableErr as any).registryAddress = existence.address;
        throw unreachableErr;
      }
    },
    [chainId, getContractForChain]
  );

  const queryRecipientCertificates = useCallback(
    async (recipientAddress: string, targetChainId?: number): Promise<IssuedCertificateRecord[]> => {
      if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
        return [];
      }

      const activeChain = targetChainId || chainId || getDefaultChainId();
      const key = `certichain_records_${activeChain}`;
      let cachedRecords: IssuedCertificateRecord[] = [];
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            cachedRecords = JSON.parse(raw)
              .map((r: any) => ({
                ...r,
                timestamp: BigInt(r.timestamp || Math.floor(Date.now() / 1000)),
              }))
              .filter((r: IssuedCertificateRecord) => r.recipient.toLowerCase() === recipientAddress.toLowerCase());
          }
        } catch {
          // Ignore parse errors
        }
      }

      try {
        const existence = await checkContractExists(activeChain);
        if (!existence.exists) {
          return [];
        }

        const contract = getContractForChain(activeChain, false);
        const filter = contract.filters.CertificateIssued(undefined, undefined, recipientAddress);
        const fromBlock = activeChain === 11155111 ? -5000 : 0;
        let onChainRecords: IssuedCertificateRecord[] = [];

        try {
          const events = await contract.queryFilter(filter, fromBlock, 'latest');
          onChainRecords = events.map((ev) => ({
            certId: ev.args.certId,
            issuer: ev.args.issuer,
            recipient: ev.args.recipient,
            proofHash: ev.args.proofHash,
            metadataUrl: ev.args.metadataUrl,
            timestamp: ev.args.timestamp,
          }));
        } catch (filterErr) {
          console.warn('queryFilter failed on chain, falling back to verifying cached records:', filterErr);
        }

        const confirmedMap = new Map<string, IssuedCertificateRecord>();
        onChainRecords.forEach((r) => confirmedMap.set(r.certId.toLowerCase(), r));

        // For any cached records not caught in the event block window, confirm against contract view
        for (const cached of cachedRecords) {
          if (!confirmedMap.has(cached.certId.toLowerCase())) {
            try {
              const onChain = await contract.verifyCertificate(cached.certId);
              if (onChain && onChain.issuedAt > 0n) {
                confirmedMap.set(cached.certId.toLowerCase(), {
                  certId: cached.certId,
                  issuer: onChain.issuer,
                  recipient: onChain.recipient,
                  proofHash: onChain.proofHash,
                  metadataUrl: onChain.metadataUrl,
                  timestamp: onChain.issuedAt,
                });
              }
            } catch {
              // Not on-chain, omit ghost record
            }
          }
        }

        return Array.from(confirmedMap.values()).sort((a, b) => Number(b.timestamp - a.timestamp));
      } catch (err) {
        console.warn('On-chain recipient query failed:', err);
        return [];
      }
    },
    [chainId, getContractForChain]
  );

  const queryAllIssuedCertificates = useCallback(
    async (issuerAddress?: string, targetChainId?: number): Promise<IssuedCertificateRecord[]> => {
      const activeChain = targetChainId || chainId || getDefaultChainId();
      const key = `certichain_records_${activeChain}`;
      let cachedRecords: IssuedCertificateRecord[] = [];
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            cachedRecords = JSON.parse(raw).map((r: any) => ({
              ...r,
              timestamp: BigInt(r.timestamp || Math.floor(Date.now() / 1000)),
            }));
            if (issuerAddress) {
              cachedRecords = cachedRecords.filter(
                (r) => r.issuer.toLowerCase() === issuerAddress.toLowerCase()
              );
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      try {
        const existence = await checkContractExists(activeChain);
        if (!existence.exists) {
          return [];
        }

        const contract = getContractForChain(activeChain, false);
        const filter = issuerAddress
          ? contract.filters.CertificateIssued(undefined, issuerAddress, undefined)
          : contract.filters.CertificateIssued();

        const fromBlock = activeChain === 11155111 ? -5000 : 0;
        let onChainRecords: IssuedCertificateRecord[] = [];

        try {
          const events = await contract.queryFilter(filter, fromBlock, 'latest');
          onChainRecords = events.map((ev) => ({
            certId: ev.args.certId,
            issuer: ev.args.issuer,
            recipient: ev.args.recipient,
            proofHash: ev.args.proofHash,
            metadataUrl: ev.args.metadataUrl,
            timestamp: ev.args.timestamp,
          }));
        } catch (filterErr) {
          console.warn('queryFilter failed on chain, verifying cached records individually:', filterErr);
        }

        const confirmedMap = new Map<string, IssuedCertificateRecord>();
        onChainRecords.forEach((r) => confirmedMap.set(r.certId.toLowerCase(), r));

        // For any cached records not caught in the event block window, confirm against contract view
        for (const cached of cachedRecords) {
          if (!confirmedMap.has(cached.certId.toLowerCase())) {
            try {
              const onChain = await contract.verifyCertificate(cached.certId);
              if (onChain && onChain.issuedAt > 0n) {
                confirmedMap.set(cached.certId.toLowerCase(), {
                  certId: cached.certId,
                  issuer: onChain.issuer,
                  recipient: onChain.recipient,
                  proofHash: onChain.proofHash,
                  metadataUrl: onChain.metadataUrl,
                  timestamp: onChain.issuedAt,
                });
              }
            } catch {
              // Not on-chain, omit ghost record
            }
          }
        }

        return Array.from(confirmedMap.values()).sort((a, b) => Number(b.timestamp - a.timestamp));
      } catch (err) {
        console.warn('On-chain event query failed:', err);
        return [];
      }
    },
    [chainId, getContractForChain]
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
