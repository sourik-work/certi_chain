import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useCertificateRegistry } from '../hooks/useCertificateRegistry';
import { useToast } from '../hooks/useToast';
import { verifyCertificateIntegrity } from '../lib/verify';
import { trace } from '../lib/debugTrace';
import {
  getRegistryAddress,
  getChainDetails,
  getDefaultChainId,
  normalizeCertId,
  checkContractExists,
  getReadProvider,
  SUPPORTED_CHAINS,
} from '../config';
import { VerificationResult } from '../components/VerificationResult';
import { VerificationResultData, IssuedCertificateRecord, OnChainCertificate } from '../types/certificate';
import {
  Search,
  ShieldCheck,
  Loader2,
  AlertOctagon,
  X,
  Layers,
  ArrowRight,
  RefreshCw,
  Globe,
} from 'lucide-react';

interface VerifyCertificateProps {
  initialCertId?: string;
}

export const VerifyCertificate: React.FC<VerifyCertificateProps> = ({ initialCertId }) => {
  const { account, chainId: walletChainId } = useWallet();
  const { verifyCertificate, isIssuerAuthorized, revokeCertificate, queryAllIssuedCertificates } =
    useCertificateRegistry();
  const { showToast } = useToast();

  const [searchInput, setSearchInput] = useState<string>(initialCertId || '');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyingStatusMsg, setVerifyingStatusMsg] = useState<string>('');
  const [result, setResult] = useState<VerificationResultData | null>(null);
  const [recentCertificates, setRecentCertificates] = useState<IssuedCertificateRecord[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState<boolean>(false);
  const [activeNetworkChainId, setActiveNetworkChainId] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const chainParam = params.get('chain');
      if (chainParam) {
        const parsed = Number(chainParam);
        if (!isNaN(parsed) && SUPPORTED_CHAINS[parsed]) return parsed;
      }
    }
    return walletChainId || getDefaultChainId();
  });

  // Revocation Modal State
  const [showRevokeModal, setShowRevokeModal] = useState<boolean>(false);
  const [revokeReason, setRevokeReason] = useState<string>('Credential revoked by issuing authority');
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadRecentCertificates = useCallback(async () => {
    setIsLoadingRecent(true);
    try {
      const records = await queryAllIssuedCertificates(undefined, activeNetworkChainId);
      if (isMountedRef.current) {
        setRecentCertificates(records);
      }
    } catch (err) {
      console.error('Failed to load recent certificates:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingRecent(false);
      }
    }
  }, [queryAllIssuedCertificates, activeNetworkChainId]);

  useEffect(() => {
    loadRecentCertificates();
  }, [loadRecentCertificates, activeNetworkChainId, walletChainId]);

  const performVerification = useCallback(
    async (rawQuery: string, explicitChainId?: number, isFresh = false) => {
      const normalized = normalizeCertId(rawQuery);
      if (!normalized.valid) {
        setResult({
          state: 'INVALID_TAMPERED',
          certId: normalized.certId || rawQuery,
          errorReason: normalized.error || 'Invalid Certificate ID format.',
          isIssuerAuthorized: false,
        });
        return;
      }

      const targetChainId = explicitChainId || normalized.chainId || activeNetworkChainId || getDefaultChainId();
      setActiveNetworkChainId(targetChainId);

      const chainInfo = getChainDetails(targetChainId);
      const targetRegistry = getRegistryAddress(targetChainId);

      setIsVerifying(true);
      setVerifyingStatusMsg('Checking smart contract registry existence...');
      setResult(null);

      try {
        trace('route', { certId: normalized.certId, targetChainId, registry: targetRegistry });

        // Step 1: Check contract existence guard (2.3)
        const existence = await checkContractExists(targetChainId);
        const readProvider = getReadProvider(targetChainId);
        let blockNumber = 0;
        try {
          blockNumber = await readProvider.getBlockNumber();
        } catch {
          // ignore
        }

        trace('chain.diag', {
          walletChainId: walletChainId || null,
          verifyChainId: targetChainId,
          verifyChainName: chainInfo.name,
          registryAddress: targetRegistry,
          codeLength: existence.codeLength,
          latestBlockNumber: blockNumber,
          certId: normalized.certId,
        });

        if (!existence.exists) {
          setResult({
            state: 'NO_CONTRACT',
            certId: normalized.certId,
            chainId: targetChainId,
            chainName: chainInfo.name,
            registryAddress: targetRegistry,
            errorReason: `No registry contract found at ${targetRegistry} on ${chainInfo.name}. The app may be configured for a different network or the chain was reset.`,
            isIssuerAuthorized: false,
          });
          return;
        }

        // Step 2: Query smart contract view (with retry loop if fresh=1 or newly issued)
        let onChainCert: OnChainCertificate | null = null;
        const maxAttempts = isFresh ? 6 : 1;
        const delayMs = 3000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (!isMountedRef.current) return;
          if (attempt > 1) {
            setVerifyingStatusMsg(`Waiting for transaction to be indexed on ${chainInfo.name} (attempt ${attempt}/${maxAttempts})...`);
            await new Promise((r) => setTimeout(r, delayMs));
          } else {
            setVerifyingStatusMsg(`Querying registry on ${chainInfo.name}...`);
          }

          try {
            onChainCert = await verifyCertificate(normalized.certId, targetChainId);
            if (onChainCert && onChainCert.issuedAt > 0n) {
              break;
            }
          } catch (err: any) {
            if (err?.code === 'NO_CONTRACT') {
              setResult({
                state: 'NO_CONTRACT',
                certId: normalized.certId,
                chainId: targetChainId,
                chainName: chainInfo.name,
                registryAddress: targetRegistry,
                errorReason: err.message,
                isIssuerAuthorized: false,
              });
              return;
            }
            if (attempt === maxAttempts) {
              setResult({
                state: 'UNREACHABLE',
                certId: normalized.certId,
                chainId: targetChainId,
                chainName: chainInfo.name,
                registryAddress: targetRegistry,
                errorReason: `Unable to reach the registry on ${chainInfo.name}: ${err.message}`,
                isIssuerAuthorized: false,
              });
              return;
            }
          }
        }

        if (!onChainCert || onChainCert.issuedAt === 0n) {
          setResult({
            state: 'NOT_FOUND',
            certId: normalized.certId,
            chainId: targetChainId,
            chainName: chainInfo.name,
            registryAddress: targetRegistry,
            errorReason: `Certificate not found in on-chain registry at ${targetRegistry} on ${chainInfo.name}.`,
            isIssuerAuthorized: false,
          });
          return;
        }

        trace('chain', {
          certId: normalized.certId,
          issuer: onChainCert.issuer,
          recipient: onChainCert.recipient,
          proofHash: onChainCert.proofHash,
          metadataUrl: onChainCert.metadataUrl,
          revoked: onChainCert.revoked,
          issuedAt: onChainCert.issuedAt.toString(),
        });

        // Step 3: Check authorization
        setVerifyingStatusMsg('Checking issuer authority...');
        const isAuth =
          onChainCert.issuer && onChainCert.issuer !== '0x0000000000000000000000000000000000000000'
            ? await isIssuerAuthorized(onChainCert.issuer, targetChainId)
            : false;

        // Step 4: Cryptographic re-hash & metadata verification
        setVerifyingStatusMsg('Retrieving IPFS payload and verifying SHA-256 integrity...');
        const walletMismatch = Boolean(walletChainId && walletChainId !== targetChainId);
        const walletChainDetails = walletChainId ? getChainDetails(walletChainId) : undefined;

        const verificationResult = await verifyCertificateIntegrity({
          certId: normalized.certId,
          onChainCert,
          isAuthorized: isAuth,
          chainId: targetChainId,
          chainName: chainInfo.name,
          registryAddress: targetRegistry,
          walletChainMismatch: walletMismatch,
          walletChainName: walletChainDetails?.name,
        });

        if (isMountedRef.current) {
          setResult(verificationResult);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Verification failed';
        trace('errors', { context: 'performVerification', certId: normalized.certId, error: msg });
        if (isMountedRef.current) {
          setResult({
            state: 'UNREACHABLE',
            certId: normalized.certId,
            chainId: targetChainId,
            chainName: chainInfo.name,
            registryAddress: targetRegistry,
            errorReason: msg,
            isIssuerAuthorized: false,
          });
        }
      } finally {
        if (isMountedRef.current) {
          setIsVerifying(false);
          setVerifyingStatusMsg('');
        }
      }
    },
    [activeNetworkChainId, isIssuerAuthorized, verifyCertificate, walletChainId]
  );

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const chainParam = params?.get('chain');
    const isFresh = params?.get('fresh') === '1';
    let targetChain: number | undefined = undefined;

    if (chainParam) {
      const parsed = Number(chainParam);
      if (!isNaN(parsed) && SUPPORTED_CHAINS[parsed]) {
        targetChain = parsed;
        setActiveNetworkChainId(parsed);
      }
    }

    if (initialCertId) {
      setSearchInput(initialCertId);
      performVerification(initialCertId, targetChain, isFresh);
    }
  }, [initialCertId, performVerification]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    const normalized = normalizeCertId(searchInput);
    const targetChain = normalized.chainId || activeNetworkChainId;
    window.history.pushState({}, '', `/verify/${normalized.certId || searchInput.trim()}?chain=${targetChain}`);
    performVerification(searchInput, targetChain);
  };

  const handleRevoke = async () => {
    if (!result || !result.certId) return;

    setIsRevoking(true);
    try {
      const txResponse = await revokeCertificate(result.certId, revokeReason);
      showToast('info', 'Revocation Broadcast', `Tx: ${txResponse.txHash.slice(0, 10)}...`);

      const receipt = await txResponse.wait(1);
      if (receipt && receipt.status === 1) {
        showToast('success', 'Certificate Revoked', 'The certificate has been revoked on-chain.');
        setShowRevokeModal(false);
        await performVerification(result.certId, result.chainId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Revocation transaction failed';
      showToast('error', 'Revocation Failed', msg);
    } finally {
      setIsRevoking(false);
    }
  };

  const isIssuerOrOwner =
    account &&
    result?.onChain?.issuer &&
    account.toLowerCase() === result.onChain.issuer.toLowerCase();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Search & Lookup Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-card text-center max-w-4xl mx-auto space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-navy-900 text-white p-3 mx-auto shadow-md flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-gold-400" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-azure-700 block mb-1">
            PUBLIC MULTI-CHAIN VERIFIER
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
            Verify a Certificate or Credential
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-2 max-w-xl mx-auto leading-relaxed">
            Verify academic diplomas, corporate certifications, and skill credentials directly against Ethereum smart contracts and IPFS. No wallet or account required.
          </p>
        </div>

        {/* Network Toggle Selector */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Verify Target Network:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
            {Object.values(SUPPORTED_CHAINS).map((chain) => (
              <button
                key={chain.chainId}
                type="button"
                onClick={() => {
                  setActiveNetworkChainId(chain.chainId);
                  if (searchInput) {
                    window.history.pushState({}, '', `/verify/${searchInput}?chain=${chain.chainId}`);
                    performVerification(searchInput, chain.chainId);
                  }
                }}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  activeNetworkChainId === chain.chainId
                    ? 'bg-navy-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-navy-900'
                }`}
              >
                {chain.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Paste 32-byte Certificate ID, proof hash, or full verification URL..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:border-navy-900 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-900 font-mono placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-navy-900/20"
            />
          </div>
          <button
            type="submit"
            disabled={isVerifying || !searchInput.trim()}
            className="btn-primary py-3 px-6 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shrink-0"
          >
            {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{isVerifying ? 'Verifying...' : 'Verify Credential'}</span>
          </button>
        </form>
      </div>

      {/* Loading Indicator */}
      {isVerifying && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-card max-w-xl mx-auto">
          <Loader2 className="w-8 h-8 text-navy-900 animate-spin mx-auto" />
          <p className="text-xs font-mono text-slate-700 font-medium">
            {verifyingStatusMsg || 'Fetching on-chain registry record and recomputing SHA-256 integrity hash...'}
          </p>
        </div>
      )}

      {/* Verification Result Display */}
      {result && !isVerifying && (
        <VerificationResult
          result={result}
          canRevoke={!!isIssuerOrOwner}
          onRevokeClick={() => setShowRevokeModal(true)}
          onRetry={() => performVerification(result.certId, result.chainId)}
        />
      )}

      {/* On-Chain Ledger Activity Explorer */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-navy-900" />
            <h3 className="text-sm sm:text-base font-bold text-navy-950">Recent On-Chain Issuances</h3>
            <span className="text-[10px] bg-navy-50 text-navy-900 border border-navy-200 px-2.5 py-0.5 rounded-full font-mono font-bold">
              {getChainDetails(activeNetworkChainId).name}: {recentCertificates.length} {recentCertificates.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>

          <button
            onClick={loadRecentCertificates}
            disabled={isLoadingRecent}
            className="text-xs text-slate-500 hover:text-navy-950 flex items-center gap-1.5 transition-colors font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecent ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {isLoadingRecent ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-navy-900" />
            <span>Querying smart contract event logs on {getChainDetails(activeNetworkChainId).name}...</span>
          </div>
        ) : recentCertificates.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 space-y-1">
            <p>No certificates have been indexed on {getChainDetails(activeNetworkChainId).name} yet.</p>
            <p className="text-[11px] text-slate-400">
              Authorized accounts can issue credentials under the <strong className="text-navy-900">Issue</strong> tab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="pb-2.5 font-bold">Proof Hash / Cert ID</th>
                  <th className="pb-2.5 font-bold">Issuer Address</th>
                  <th className="pb-2.5 font-bold">Recipient Address</th>
                  <th className="pb-2.5 font-bold">Issued At</th>
                  <th className="pb-2.5 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCertificates.map((cert) => {
                  const dateStr = cert.timestamp
                    ? new Date(Number(cert.timestamp) * 1000).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A';
                  return (
                    <tr
                      key={cert.certId}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSearchInput(cert.certId);
                        window.history.pushState(
                          {},
                          '',
                          `/verify/${cert.certId}?chain=${activeNetworkChainId}`
                        );
                        performVerification(cert.certId, activeNetworkChainId);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <td className="py-3.5 font-mono text-navy-950 font-bold truncate max-w-[140px]">
                        {cert.proofHash ? `${cert.proofHash.slice(0, 10)}...${cert.proofHash.slice(-8)}` : cert.certId}
                      </td>
                      <td className="py-3.5 font-mono text-slate-600 truncate max-w-[120px]">
                        {cert.issuer ? `${cert.issuer.slice(0, 6)}...${cert.issuer.slice(-4)}` : 'N/A'}
                      </td>
                      <td className="py-3.5 font-mono text-slate-600 truncate max-w-[120px]">
                        {cert.recipient ? `${cert.recipient.slice(0, 6)}...${cert.recipient.slice(-4)}` : 'Public (0x0)'}
                      </td>
                      <td className="py-3.5 text-slate-500 font-mono text-[11px]">
                        {dateStr}
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchInput(cert.certId);
                            window.history.pushState(
                              {},
                              '',
                              `/verify/${cert.certId}?chain=${activeNetworkChainId}`
                            );
                            performVerification(cert.certId, activeNetworkChainId);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="btn-secondary py-1 px-2.5 text-xs font-bold"
                        >
                          <span>Verify</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revocation Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-floating">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertOctagon className="w-5 h-5" />
                <span>Revoke Certificate On-Chain</span>
              </div>
              <button
                onClick={() => setShowRevokeModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to revoke this certificate? This action permanently updates the on-chain smart contract record to <strong className="text-rose-700">REVOKED</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-navy-950 mb-1">
                Revocation Justification *
              </label>
              <textarea
                rows={2}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Reason for revocation..."
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-600 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={handleRevoke}
                disabled={isRevoking || !revokeReason.trim()}
                className="btn-danger flex-1"
              >
                {isRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertOctagon className="w-3.5 h-3.5" />}
                <span>{isRevoking ? 'Revoking...' : 'Confirm Revocation'}</span>
              </button>
              <button
                onClick={() => setShowRevokeModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

