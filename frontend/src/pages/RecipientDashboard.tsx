import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useCertificateRegistry } from '../hooks/useCertificateRegistry';
import { useToast } from '../hooks/useToast';
import { fetchMetadataFromIpfs } from '../lib/pinata';
import { CertificatePreview } from '../components/CertificatePreview';
import { IssuedCertificateRecord, CertificateMetadata, OnChainCertificate } from '../types/certificate';
import { WalletModal } from '../components/WalletModal';
import {
  Award,
  Calendar,
  ExternalLink,
  Eye,
  FileCheck,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
  X,
} from 'lucide-react';

interface RecipientDashboardProps {
  onNavigateToVerify: (certId: string) => void;
  onSelectForExport?: (cert: IssuedCertificateRecord & { metadata?: CertificateMetadata }) => void;
}

interface EnrichedCertificate extends IssuedCertificateRecord {
  metadata?: CertificateMetadata;
  onChainStatus?: OnChainCertificate;
  isLoadingMetadata?: boolean;
}

export const RecipientDashboard: React.FC<RecipientDashboardProps> = ({
  onNavigateToVerify,
  onSelectForExport,
}) => {
  const { account, isConnected } = useWallet();
  const { queryRecipientCertificates, verifyCertificate } = useCertificateRegistry();
  const { showToast } = useToast();

  const [certificates, setCertificates] = useState<EnrichedCertificate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCert, setSelectedCert] = useState<EnrichedCertificate | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const loadCertificates = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);

    try {
      const records = await queryRecipientCertificates(account);

      // Initialize items with skeleton status
      const initial: EnrichedCertificate[] = records.map((r) => ({
        ...r,
        isLoadingMetadata: true,
      }));
      setCertificates(initial);

      // Asynchronously fetch IPFS metadata & on-chain status for each record
      const enriched = await Promise.all(
        records.map(async (record) => {
          let metadata: CertificateMetadata | undefined;
          let onChainStatus: OnChainCertificate | undefined;

          try {
            metadata = await fetchMetadataFromIpfs(record.metadataUrl);
          } catch (err) {
            console.warn(`Failed to fetch IPFS metadata for ${record.certId}:`, err);
          }

          try {
            onChainStatus = await verifyCertificate(record.certId);
          } catch (err) {
            console.warn(`Failed to verify on-chain status for ${record.certId}:`, err);
          }

          return {
            ...record,
            metadata,
            onChainStatus,
            isLoadingMetadata: false,
          };
        })
      );

      setCertificates(enriched);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query certificate records';
      showToast('error', 'Query Failed', message);
    } finally {
      setIsLoading(false);
    }
  }, [account, queryRecipientCertificates, verifyCertificate, showToast]);

  useEffect(() => {
    if (isConnected && account) {
      loadCertificates();
    } else {
      setCertificates([]);
    }
  }, [isConnected, account, loadCertificates]);

  const filteredCertificates = certificates.filter((cert) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = cert.metadata?.certificateTitle?.toLowerCase().includes(q);
    const issuerMatch = cert.metadata?.issuerName?.toLowerCase().includes(q) || cert.issuer.toLowerCase().includes(q);
    const hashMatch = cert.certId.toLowerCase().includes(q) || cert.proofHash.toLowerCase().includes(q);
    return titleMatch || issuerMatch || hashMatch;
  });

  if (!isConnected) {
    return (
      <div className="glass-panel p-12 text-center max-w-xl mx-auto space-y-6 animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto text-teal-400">
          <Wallet className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Connect Your Wallet</h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Connect your Web3 wallet or choose a 1-click local test account to retrieve credentials and achievements issued to your address on the blockchain.
          </p>
        </div>
        <button onClick={() => setWalletModalOpen(true)} className="btn-primary py-3 px-6 text-sm font-semibold">
          Connect Wallet
        </button>

        <WalletModal
          isOpen={walletModalOpen}
          onClose={() => setWalletModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-300 to-emerald-400 bg-clip-text text-transparent">
            My Verifiable Credentials
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Browse, inspect, verify, and export credentials anchored to your wallet address.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search credentials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
            />
          </div>

          <button
            onClick={loadCertificates}
            disabled={isLoading}
            className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 shrink-0"
            title="Refresh records from blockchain"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && certificates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          <p className="text-sm text-slate-400 font-mono">Querying blockchain logs for recipient address...</p>
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="glass-panel p-12 text-center max-w-lg mx-auto space-y-4">
          <FileCheck className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-200">No Credentials Found</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {searchQuery
              ? 'No certificates match your search query.'
              : 'No certificates have been issued to this address yet. When an authorized issuer grants you a credential, it will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCertificates.map((cert) => {
            const isRevoked = cert.onChainStatus?.revoked ?? false;
            const title = cert.metadata?.certificateTitle || 'Verifiable Credential';
            const issuer = cert.metadata?.issuerName || `${cert.issuer.slice(0, 8)}...${cert.issuer.slice(-6)}`;
            const dateStr = cert.metadata?.issueDate
              ? new Date(cert.metadata.issueDate).toLocaleDateString()
              : new Date(Number(cert.timestamp) * 1000).toLocaleDateString();

            return (
              <div
                key={cert.certId}
                className="glass-card p-6 flex flex-col justify-between space-y-5 relative overflow-hidden group"
              >
                {/* Status indicator pill */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                      <Award className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300 truncate max-w-[140px]">
                      {issuer}
                    </span>
                  </div>

                  {isRevoked ? (
                    <span className="badge-revoked">Revoked</span>
                  ) : (
                    <span className="badge-valid">Active</span>
                  )}
                </div>

                {/* Title and date */}
                <div>
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-teal-300 transition-colors line-clamp-2">
                    {title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Issued: {dateStr}</span>
                  </div>
                </div>

                {/* Proof Hash snippet */}
                <div className="bg-slate-950/80 p-2.5 rounded-lg text-[10px] font-mono text-slate-400 border border-slate-800/80">
                  <p className="text-slate-500 text-[9px] uppercase tracking-wider">Proof Hash</p>
                  <p className="truncate text-teal-400/90">{cert.proofHash}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => setSelectedCert(cert)}
                    className="btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect
                  </button>

                  <button
                    onClick={() => onNavigateToVerify(cert.certId)}
                    className="btn-primary py-2 px-3 text-xs flex items-center justify-center gap-1"
                    title="Open public verification page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Certificate Modal Preview */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-lg font-bold text-slate-100">Certificate Inspection</h3>
              <button
                onClick={() => setSelectedCert(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <CertificatePreview
              metadata={
                selectedCert.metadata || {
                  schemaVersion: '1.0',
                  certificateTitle: 'Loading metadata...',
                  recipientName: account || 'Recipient',
                  recipientIdentifier: account || '0x...',
                  issuerName: selectedCert.issuer,
                  issuerAddress: selectedCert.issuer,
                  issueDate: new Date(Number(selectedCert.timestamp) * 1000).toISOString(),
                  expiryDate: null,
                  description: 'Decentralized IPFS metadata loading...',
                }
              }
              proofHash={selectedCert.proofHash}
              certId={selectedCert.certId}
              isRevoked={selectedCert.onChainStatus?.revoked ?? false}
              revocationTimestamp={selectedCert.onChainStatus?.revokedAt}
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  if (onSelectForExport) onSelectForExport(selectedCert);
                  onNavigateToVerify(selectedCert.certId);
                }}
                className="btn-primary text-xs"
              >
                Export PDF / PNG & Verify
              </button>
              <button onClick={() => setSelectedCert(null)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
