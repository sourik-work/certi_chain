import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useCertificateRegistry } from '../hooks/useCertificateRegistry';
import { useToast } from '../hooks/useToast';
import { CertificatePreview } from '../components/CertificatePreview';
import { TransactionStatus, TxStep } from '../components/TransactionStatus';
import { validateAndSanitizeMetadata } from '../lib/validateMetadata';
import { computeProofHash } from '../lib/hash';
import { pinMetadataToIpfs } from '../lib/pinata';
import { IssuanceFormData, CertificateMetadata } from '../types/certificate';
import { WalletModal } from '../components/WalletModal';
import { Plus, Trash2, Send, ShieldAlert, Sparkles, CheckCircle2, Wallet } from 'lucide-react';

interface IssuerDashboardProps {
  onNavigateToVerify: (certId: string) => void;
}

export const IssuerDashboard: React.FC<IssuerDashboardProps> = ({ onNavigateToVerify }) => {
  const { account, isConnected } = useWallet();
  const { isIssuerAuthorized, issueCertificate } = useCertificateRegistry();
  const { showToast } = useToast();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<IssuanceFormData>({
    recipientName: 'Alice Nakamoto',
    recipientIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    certificateTitle: 'Master in Smart Contract Architecture & Security',
    issuerName: 'Decentralized Academic Consortium',
    description: 'Conferred with high honors for designing zero-exploit smart contract protocols.',
    issueDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    additionalFields: [
      { key: 'Grade', value: 'Distinction (A+)' },
      { key: 'Credits', value: '45 ECTS' },
    ],
  });

  // Tx Lifecycle State
  const [txStep, setTxStep] = useState<TxStep>('idle');
  const [txHash, setTxHash] = useState<string | undefined>();
  const [confirmations, setConfirmations] = useState<number>(0);
  const [txError, setTxError] = useState<string | undefined>();
  const [issuedCertId, setIssuedCertId] = useState<string | undefined>();

  // Live computed proofHash for preview
  const [previewHash, setPreviewHash] = useState<string>('0x...');

  // Check authorization when account changes
  useEffect(() => {
    let isMounted = true;
    if (account) {
      setCheckingAuth(true);
      isIssuerAuthorized(account)
        .then((auth) => {
          if (isMounted) setIsAuthorized(auth);
        })
        .finally(() => {
          if (isMounted) setCheckingAuth(false);
        });
    } else {
      setIsAuthorized(null);
    }
    return () => {
      isMounted = false;
    };
  }, [account, isIssuerAuthorized]);

  // Update live preview hash when form changes
  useEffect(() => {
    let isCancelled = false;
    const additionalMap: Record<string, string> = {};
    formData.additionalFields.forEach((f) => {
      if (f.key.trim()) additionalMap[f.key.trim()] = f.value.trim();
    });

    const previewPayload: CertificateMetadata = {
      schemaVersion: '1.0',
      certificateTitle: formData.certificateTitle,
      recipientName: formData.recipientName,
      recipientIdentifier: formData.recipientIdentifier || formData.recipientAddress,
      issuerName: formData.issuerName,
      issuerAddress: account || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      issueDate: formData.issueDate ? new Date(formData.issueDate).toISOString() : new Date().toISOString(),
      expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : null,
      description: formData.description,
      additionalFields: additionalMap,
    };

    computeProofHash(previewPayload)
      .then((h) => {
        if (!isCancelled) setPreviewHash(h);
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [formData, account]);

  const handleFieldChange = (key: keyof IssuanceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleAdditionalFieldChange = (index: number, key: string, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.additionalFields];
      updated[index] = { key, value };
      return { ...prev, additionalFields: updated };
    });
  };

  const addAdditionalField = () => {
    setFormData((prev) => ({
      ...prev,
      additionalFields: [...prev.additionalFields, { key: '', value: '' }],
    }));
  };

  const removeAdditionalField = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      additionalFields: prev.additionalFields.filter((_, i) => i !== index),
    }));
  };

  // Issuance Pipeline
  const handleIssue = async () => {
    if (!isConnected || !account) {
      setWalletModalOpen(true);
      showToast('warning', 'Wallet Connection Required', 'Please select or connect an issuer account to anchor credentials.');
      return;
    }

    setTxError(undefined);
    setTxHash(undefined);
    setConfirmations(0);

    try {
      // Step 1: Validate Schema & Sanitize
      setTxStep('validating');
      const additionalMap: Record<string, string> = {};
      formData.additionalFields.forEach((f) => {
        if (f.key.trim()) additionalMap[f.key.trim()] = f.value.trim();
      });

      const validation = validateAndSanitizeMetadata({
        schemaVersion: '1.0',
        certificateTitle: formData.certificateTitle,
        recipientName: formData.recipientName,
        recipientIdentifier: formData.recipientIdentifier || formData.recipientAddress,
        issuerName: formData.issuerName,
        issuerAddress: account,
        issueDate: formData.issueDate,
        expiryDate: formData.expiryDate || null,
        description: formData.description,
        additionalFields: additionalMap,
      });

      if (!validation.isValid || !validation.sanitizedData) {
        throw new Error(validation.errors.join(' '));
      }

      // Step 2: Compute Proof Hash
      setTxStep('hashing');
      const proofHash = await computeProofHash(validation.sanitizedData);

      // Step 3: Pin to IPFS via serverless proxy
      setTxStep('pinning');
      // Attach proofHash for self-reference (excluded from hash calculation per Decision 2.8)
      const metadataToPin: CertificateMetadata = {
        ...validation.sanitizedData,
        issuedProofHash: proofHash,
      };

      const pinResult = await pinMetadataToIpfs(metadataToPin);
      showToast('info', 'IPFS Pin Successful', `CID: ${pinResult.ipfsHash.slice(0, 16)}...`);

      // Step 4: Awaiting Wallet Signature
      setTxStep('awaiting_signature');
      const recipientOnChain = formData.recipientAddress.trim();

      const txResponse = await issueCertificate(
        proofHash,
        pinResult.metadataUrl,
        recipientOnChain
      );

      setTxHash(txResponse.txHash);
      setTxStep('mining');
      showToast('info', 'Transaction Broadcast', `Tx: ${txResponse.txHash.slice(0, 12)}...`);

      // Step 5: Wait for receipt
      const receipt = await txResponse.wait(1);
      if (receipt && receipt.status === 1) {
        setConfirmations(1);
        setIssuedCertId(proofHash);
        setTxStep('confirmed');
        showToast('success', 'Credential Issued!', 'Certificate successfully registered on-chain.');
      } else {
        throw new Error('Transaction was reverted on-chain.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTxError(msg);
      setTxStep('error');
      showToast('error', 'Issuance Failed', msg);
    }
  };

  const previewMetadata: CertificateMetadata = {
    schemaVersion: '1.0',
    certificateTitle: formData.certificateTitle,
    recipientName: formData.recipientName,
    recipientIdentifier: formData.recipientIdentifier || formData.recipientAddress,
    issuerName: formData.issuerName,
    issuerAddress: account || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    issueDate: formData.issueDate ? new Date(formData.issueDate).toISOString() : new Date().toISOString(),
    expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : null,
    description: formData.description,
    additionalFields: formData.additionalFields.reduce((acc, curr) => {
      if (curr.key.trim()) acc[curr.key.trim()] = curr.value.trim();
      return acc;
    }, {} as Record<string, string>),
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-300 to-emerald-400 bg-clip-text text-transparent">
            Issue Decentralized Credential
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create, sanitize, IPFS pin, and immutably anchor verifiable credentials to the blockchain.
          </p>
        </div>

        {/* Issuer Whitelist Status Badge */}
        {isConnected && (
          <div className="flex items-center gap-2">
            {checkingAuth ? (
              <span className="text-xs text-slate-400">Verifying issuer status...</span>
            ) : isAuthorized ? (
              <div className="badge-valid px-3 py-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Authorized Issuer</span>
              </div>
            ) : (
              <div className="badge-tampered px-3 py-1.5 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Issuer Whitelist Required</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction Status Tracker */}
      <TransactionStatus
        step={txStep}
        txHash={txHash}
        confirmations={confirmations}
        error={txError}
        certId={issuedCertId}
        onReset={() => {
          setTxStep('idle');
          setTxError(undefined);
          setTxHash(undefined);
        }}
        onViewCertificate={(id) => onNavigateToVerify(id)}
      />

      {/* Main Grid: Form Left, Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Issuance Form */}
        <div className="lg:col-span-5 space-y-6 glass-panel p-6 border-slate-800/80">
          <div className="flex items-center gap-2 text-teal-300 font-semibold text-sm border-b border-slate-800 pb-3">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>Credential Specification</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Certificate Title *
              </label>
              <input
                type="text"
                value={formData.certificateTitle}
                onChange={(e) => handleFieldChange('certificateTitle', e.target.value)}
                placeholder="e.g. Master in Blockchain Architecture"
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Recipient Full Name *
              </label>
              <input
                type="text"
                value={formData.recipientName}
                onChange={(e) => handleFieldChange('recipientName', e.target.value)}
                placeholder="e.g. Alice Nakamoto"
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recipient Wallet Address
                </label>
                <input
                  type="text"
                  value={formData.recipientAddress}
                  onChange={(e) => handleFieldChange('recipientAddress', e.target.value)}
                  placeholder="0x... (or leave 0x0)"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recipient Email / ID
                </label>
                <input
                  type="text"
                  value={formData.recipientIdentifier}
                  onChange={(e) => handleFieldChange('recipientIdentifier', e.target.value)}
                  placeholder="alice@domain.org"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Issuer Organization Name *
              </label>
              <input
                type="text"
                value={formData.issuerName}
                onChange={(e) => handleFieldChange('issuerName', e.target.value)}
                placeholder="e.g. Decentralized Academic Consortium"
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Credential Description
              </label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Describe the skills and achievement accredited..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Date of Issue *
                </label>
                <input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => handleFieldChange('issueDate', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => handleFieldChange('expiryDate', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Custom Key-Value Fields */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300">Additional Fields</label>
                <button
                  type="button"
                  onClick={addAdditionalField}
                  className="text-teal-400 hover:text-teal-300 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Field
                </button>
              </div>

              <div className="space-y-2">
                {formData.additionalFields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Key (e.g. Grade)"
                      value={field.key}
                      onChange={(e) => handleAdditionalFieldChange(idx, e.target.value, field.value)}
                      className="w-1/3 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. Distinction)"
                      value={field.value}
                      onChange={(e) => handleAdditionalFieldChange(idx, field.key, e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeAdditionalField(idx)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            {!isConnected && (
              <div className="p-3 rounded-xl bg-teal-950/30 border border-teal-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-teal-200">
                  <Wallet className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Connect with 1-click Dev Account or MetaMask</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(true)}
                  className="text-xs font-semibold text-teal-300 hover:text-teal-100 underline underline-offset-2"
                >
                  Connect
                </button>
              </div>
            )}

            <button
              onClick={handleIssue}
              disabled={['validating', 'hashing', 'pinning', 'awaiting_signature', 'mining'].includes(
                txStep
              )}
              className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isConnected ? 'Anchor & Issue Certificate On-Chain' : 'Connect Wallet & Issue On-Chain'}
            </button>
          </div>
        </div>

        {/* Live Certificate Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Live Interactive Preview (Rendered as Issued)</span>
            <span className="font-mono text-teal-400">Proof Hash: {previewHash.slice(0, 10)}...</span>
          </div>

          <CertificatePreview
            metadata={previewMetadata}
            proofHash={previewHash}
            isAuthorizedIssuer={isAuthorized ?? true}
          />
        </div>
      </div>

      {/* Wallet Modal */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </div>
  );
};
