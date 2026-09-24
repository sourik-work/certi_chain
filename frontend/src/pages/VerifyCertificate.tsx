import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useCertificateRegistry } from '../hooks/useCertificateRegistry';
import { useToast } from '../hooks/useToast';
import { verifyCertificateIntegrity } from '../lib/verify';
import { VerificationResult } from '../components/VerificationResult';
import { VerificationResultData, IssuedCertificateRecord } from '../types/certificate';
import { Search, ShieldCheck, Loader2, AlertOctagon, X, Layers, Clock, ArrowRight, RefreshCw } from 'lucide-react';

interface VerifyCertificateProps {
  initialCertId?: string;
}

export const VerifyCertificate: React.FC<VerifyCertificateProps> = ({ initialCertId }) => {
  const { account } = useWallet();
  const { verifyCertificate, isIssuerAuthorized, revokeCertificate, queryAllIssuedCertificates } = useCertificateRegistry();
  const { showToast } = useToast();

  const [searchInput, setSearchInput] = useState<string>(initialCertId || '');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [result, setResult] = useState<VerificationResultData | null>(null);
  const [recentCertificates, setRecentCertificates] = useState<IssuedCertificateRecord[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState<boolean>(false);

  // Revocation Modal State
  const [showRevokeModal, setShowRevokeModal] = useState<boolean>(false);
  const [revokeReason, setRevokeReason] = useState<string>('Credential revoked by issuing authority');
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  const loadRecentCertificates = useCallback(async () => {
    setIsLoadingRecent(true);
    try {
      const records = await queryAllIssuedCertificates();
      // Most recent first
      setRecentCertificates([...records].reverse());
    } catch (err) {
      console.error('Failed to load recent certificates:', err);
    } finally {
      setIsLoadingRecent(false);
    }
  }, [queryAllIssuedCertificates]);

  useEffect(() => {
    loadRecentCertificates();
  }, [loadRecentCertificates]);

  const performVerification = useCallback(
    async (rawQuery: string) => {
      let cleanId = rawQuery.trim();
      if (!cleanId) return;

      // Strip URL prefix if a full verification URL was pasted
      if (cleanId.includes('/verify/')) {
        cleanId = cleanId.split('/verify/')[1].split('?')[0].split('#')[0];
      }

      setIsVerifying(true);
      setResult(null);

      try {
        // Step 1: Query smart contract view (walletless zero-cost query)
        const onChainCert = await verifyCertificate(cleanId);
        const isAuth = onChainCert.issuer
          ? await isIssuerAuthorized(onChainCert.issuer)
          : false;

        // Step 2: Cryptographic re-hash & metadata verification
        const verificationResult = await verifyCertificateIntegrity({
          certId: cleanId,
          onChainCert,
          isAuthorized: isAuth,
        });

        setResult(verificationResult);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Verification failed';
        setResult({
          state: 'INVALID_TAMPERED',
          certId: cleanId,
          errorReason: msg,
        });
      } finally {
        setIsVerifying(false);
      }
    },
    [verifyCertificate, isIssuerAuthorized]
  );

  useEffect(() => {
    if (initialCertId) {
      setSearchInput(initialCertId);
      performVerification(initialCertId);
    }
  }, [initialCertId, performVerification]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(searchInput);
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
        // Refresh verification state
        await performVerification(result.certId);
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
    (account.toLowerCase() === result.onChain.issuer.toLowerCase());

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Search & Lookup Header */}
      <div className="glass-panel p-8 text-center max-w-3xl mx-auto space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 mx-auto shadow-lg shadow-teal-500/20">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-teal-400" />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-300 to-emerald-400 bg-clip-text text-transparent">
            Public Credential Verification Portal
          </h1>
          <p className="text-slate-400 text-sm mt-2 max-w-xl mx-auto leading-relaxed">
            Verify academic diplomas, corporate certifications, and skill credentials directly against the EVM blockchain and IPFS. No wallet or account required.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Paste Certificate ID / SHA-256 Proof Hash / Share Link..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <button
            type="submit"
            disabled={isVerifying || !searchInput.trim()}
            className="btn-primary py-3 px-6 text-xs font-semibold flex items-center justify-center gap-2 shrink-0"
          >
            {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {isVerifying ? 'Verifying...' : 'Verify Credential'}
          </button>
        </form>
      </div>

      {/* Loading Indicator */}
      {isVerifying && (
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          <p className="text-xs font-mono text-slate-400">
            Fetching on-chain record and recomputing SHA-256 integrity hash...
          </p>
        </div>
      )}

      {/* Verification Result Display */}
      {result && !isVerifying && (
        <VerificationResult
          result={result}
          canRevoke={!!isIssuerOrOwner}
          onRevokeClick={() => setShowRevokeModal(true)}
        />
      )}

      {/* On-Chain Ledger Activity Explorer */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/50 backdrop-blur-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-slate-100">Live On-Chain Credential Ledger</h3>
            <span className="text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded-full font-mono">
              {recentCertificates.length} {recentCertificates.length === 1 ? 'Record' : 'Records'} Anchored
            </span>
          </div>

          <button
            onClick={loadRecentCertificates}
            disabled={isLoadingRecent}
            className="text-xs text-slate-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecent ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoadingRecent ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-teal-400" /> Loading on-chain records...
          </div>
        ) : recentCertificates.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 space-y-1">
            <p>No certificates have been issued on this blockchain network yet.</p>
            <p className="text-[11px] text-slate-600">
              Go to the <span className="text-teal-400 font-semibold">Issue Credential</span> tab to anchor your first certificate.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="pb-2 font-medium">Proof Hash / Cert ID</th>
                  <th className="pb-2 font-medium">Issuer Address</th>
                  <th className="pb-2 font-medium">Recipient Address</th>
                  <th className="pb-2 font-medium">Issued At</th>
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
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
                    <tr key={cert.certId} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="py-3 font-mono text-teal-300 truncate max-w-[140px]">
                        {cert.proofHash ? `${cert.proofHash.slice(0, 10)}...${cert.proofHash.slice(-8)}` : cert.certId}
                      </td>
                      <td className="py-3 font-mono text-slate-300 truncate max-w-[120px]">
                        {cert.issuer ? `${cert.issuer.slice(0, 6)}...${cert.issuer.slice(-4)}` : 'N/A'}
                      </td>
                      <td className="py-3 font-mono text-slate-400 truncate max-w-[120px]">
                        {cert.recipient ? `${cert.recipient.slice(0, 6)}...${cert.recipient.slice(-4)}` : 'Public (0x0)'}
                      </td>
                      <td className="py-3 text-slate-400 font-mono text-[11px] flex items-center gap-1.5 mt-2">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {dateStr}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => {
                            setSearchInput(cert.certId);
                            performVerification(cert.certId);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="btn-secondary py-1 px-2.5 text-[11px] inline-flex items-center gap-1 text-teal-300 hover:text-white"
                        >
                          Verify <ArrowRight className="w-3 h-3" />
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 max-w-md w-full space-y-4 border-rose-500/30 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertOctagon className="w-5 h-5" />
                <span>Revoke Certificate On-Chain</span>
              </div>
              <button
                onClick={() => setShowRevokeModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to revoke this certificate? This action is immutable and permanently flags the credential as REVOKED on the blockchain.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Revocation Reason *
              </label>
              <textarea
                rows={2}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Reason for revocation..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleRevoke}
                disabled={isRevoking || !revokeReason.trim()}
                className="btn-danger flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                {isRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertOctagon className="w-3.5 h-3.5" />}
                {isRevoking ? 'Revoking...' : 'Confirm Revocation'}
              </button>
              <button
                onClick={() => setShowRevokeModal(false)}
                className="btn-secondary py-2 px-4 text-xs"
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
