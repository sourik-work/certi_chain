import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useCertificateRegistry } from '../hooks/useCertificateRegistry';
import { useToast } from '../hooks/useToast';
import { fetchMetadataFromIpfs } from '../lib/pinata';
import { CertificateView } from '../components/CertificateView';
import { IssuedCertificateRecord, CertificateMetadata, OnChainCertificate } from '../types/certificate';
import { TemplateSpec } from '../lib/template/types';
import { getTemplate } from '../lib/template/store';
import { WalletModal } from '../components/WalletModal';
import { StatusBadge } from '../components/ui/StatusBadge';
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
  templateSpec?: TemplateSpec | null;
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
  const [filterState, setFilterState] = useState<'all' | 'valid' | 'revoked'>('all');
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
          let templateSpec: TemplateSpec | null = null;
          let onChainStatus: OnChainCertificate | undefined;

          try {
            metadata = await fetchMetadataFromIpfs(record.metadataUrl);
            if (metadata?.template?.cid) {
              const localTpl = await getTemplate(metadata.template.cid);
              if (localTpl?.spec) {
                templateSpec = localTpl.spec;
              } else {
                templateSpec = (await fetchMetadataFromIpfs(metadata.template.cid)) as unknown as TemplateSpec;
              }
            }
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
            templateSpec,
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
    if (filterState === 'valid' && cert.onChainStatus?.revoked) return false;
    if (filterState === 'revoked' && !cert.onChainStatus?.revoked) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = cert.metadata?.certificateTitle?.toLowerCase().includes(q);
    const issuerMatch = cert.metadata?.issuerName?.toLowerCase().includes(q) || cert.issuer.toLowerCase().includes(q);
    const hashMatch = cert.certId.toLowerCase().includes(q) || cert.proofHash.toLowerCase().includes(q);
    return titleMatch || issuerMatch || hashMatch;
  });

  if (!isConnected) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-6 shadow-card animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-navy-50 border border-navy-200 flex items-center justify-center mx-auto text-navy-900">
          <Wallet className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-navy-950">Connect Your Wallet</h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Connect your Web3 wallet or choose a 1-click local test account to retrieve credentials and achievements issued to your address on the blockchain.
          </p>
        </div>
        <button onClick={() => setWalletModalOpen(true)} className="btn-primary py-3 px-6 text-sm font-bold">
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
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-azure-700 block mb-1">
            HOLDER CREDENTIAL PORTFOLIO
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
            My Verifiable Certificates
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Browse, inspect, share, and export credentials anchored to your wallet address.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title or issuer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            />
          </div>

          <button
            onClick={loadCertificates}
            disabled={isLoading}
            className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 shrink-0"
            title="Refresh records from blockchain"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterState('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
            filterState === 'all'
              ? 'bg-navy-900 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All ({certificates.length})
        </button>
        <button
          onClick={() => setFilterState('valid')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
            filterState === 'valid'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Active Credentials
        </button>
        <button
          onClick={() => setFilterState('revoked')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
            filterState === 'revoked'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Revoked Records
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading && certificates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-4 shadow-card">
          <Loader2 className="w-8 h-8 text-navy-900 animate-spin mx-auto" />
          <p className="text-xs sm:text-sm text-slate-600 font-mono">Querying blockchain logs for recipient address...</p>
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-4 shadow-card">
          <FileCheck className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-navy-950">No Credentials Found</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
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
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-5"
              >
                {/* Status indicator pill */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center text-navy-900">
                      <Award className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-navy-950 truncate max-w-[140px]">
                      {issuer}
                    </span>
                  </div>

                  {isRevoked ? (
                    <StatusBadge status="revoked" label="Revoked" size="sm" />
                  ) : (
                    <StatusBadge status="valid" label="Active" size="sm" />
                  )}
                </div>

                {/* Title and date */}
                <div>
                  <h3 className="text-base font-bold text-navy-950 transition-colors line-clamp-2">
                    {title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Issued: {dateStr}</span>
                  </div>
                </div>

                {/* Proof Hash snippet */}
                <div className="bg-slate-50 p-2.5 rounded-lg text-[10px] font-mono text-slate-600 border border-slate-200">
                  <p className="text-slate-400 text-[9px] uppercase font-bold">Proof Hash</p>
                  <p className="truncate text-navy-950 font-bold">{cert.proofHash}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedCert(cert)}
                    className="btn-secondary flex-1 py-2 text-xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-navy-900" />
                    <span>Inspect</span>
                  </button>

                  <button
                    onClick={() => onNavigateToVerify(cert.certId)}
                    className="btn-primary py-2 px-3 text-xs"
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
        <div className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto space-y-4 bg-white p-6 rounded-2xl shadow-floating border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-navy-950">Certificate Inspection</h3>
              <button
                onClick={() => setSelectedCert(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
                aria-label="Close inspection modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <CertificateView
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
              templateSpec={selectedCert.templateSpec}
              templateValues={selectedCert.metadata?.templateValues}
              proofHash={selectedCert.proofHash}
              certId={selectedCert.certId}
              isRevoked={selectedCert.onChainStatus?.revoked ?? false}
              revocationTimestamp={selectedCert.onChainStatus?.revokedAt}
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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
