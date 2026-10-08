/**
 * Issuer Dashboard Page
 * Supports dual issuance modes:
 * 1. Standard Institutional Certificate
 * 2. Custom Certificate (Upload -> AI Detection -> Fill & Live Preview -> Edit & On-Chain Issuance)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useCertificateRegistry } from '../hooks/useCertificateRegistry';
import { useToast } from '../hooks/useToast';
import { CertificateView } from '../components/CertificateView';
import { TransactionStatus, TxStep } from '../components/TransactionStatus';
import { validateAndSanitizeMetadata } from '../lib/validateMetadata';
import { computeProofHash } from '../lib/hash';
import { pinMetadataToIpfs, pinBinaryToIpfs } from '../lib/pinata';
import { PinError } from '../lib/pinErrors';
import { computeLayoutHash } from '../lib/layoutHash';
import { renderCustomCertificateCanvas } from '../lib/renderCertificate';
import { resolveCustomCertificateInfo } from '../lib/customMetadataHelper';
import type { IssuanceFormData, CertificateMetadata } from '../types/certificate';
import {
  SUPPORTED_CHAINS,
  getChainDetails,
  getRegistryAddress,
  getDefaultChainId,
} from '../config';
import { WalletModal } from '../components/WalletModal';
import { StandardIssueForm } from '../components/StandardIssueForm';
import { TemplateUploader, UploadedTemplatePayload } from '../components/custom/TemplateUploader';
import { FieldCanvas } from '../components/custom/FieldCanvas';
import { FieldInspector } from '../components/custom/FieldInspector';
import { DynamicForm } from '../components/custom/DynamicForm';
import { TemplatePreview } from '../components/custom/TemplatePreview';
import { EditorProviderPicker } from '../components/custom/EditorProviderPicker';
import { QuickEditor } from '../components/custom/QuickEditor';
import { RevisionTimeline } from '../components/custom/RevisionTimeline';
import { IssueProgress, CustomIssueStage, CustomErrorDetails } from '../components/custom/IssueProgress';
import { useCustomTemplate, CustomStepperStep } from '../hooks/useCustomTemplate';
import { useTemplateAnalysis } from '../hooks/useTemplateAnalysis';
import type { CertificateTemplate } from '../types/customTemplate';
import { useLayoutRedesign } from '../hooks/useLayoutRedesign';
import { BeforeAfterSlider } from '../components/custom/BeforeAfterSlider';
import { SavedTemplatesGallery } from '../components/custom/SavedTemplatesGallery';
import { getSavedCustomTemplates, saveSavedCustomTemplate } from '../lib/savedTemplatesStore';
import {
  Send,
  ShieldAlert,
  CheckCircle2,
  Wallet,
  Globe,
  Layout,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  X,
  Loader2,
  Check,
  Bookmark,
} from 'lucide-react';

interface IssuerDashboardProps {
  onNavigateToVerify: (certId: string) => void;
}

export const IssuerDashboard: React.FC<IssuerDashboardProps> = ({ onNavigateToVerify }) => {
  const { account, isConnected, chainId } = useWallet();
  const { isIssuerAuthorized, issueCertificate } = useCertificateRegistry();
  const { showToast } = useToast();

  const activeChainId = chainId || getDefaultChainId();
  const activeChainDetails = getChainDetails(activeChainId);
  const activeRegistryAddress = getRegistryAddress(activeChainId);

  const [activeTab, setActiveTab] = useState<'standard' | 'custom' | 'saved'>('standard');
  const [savedTemplatesCount, setSavedTemplatesCount] = useState<number>(0);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Sync saved templates count
  useEffect(() => {
    setSavedTemplatesCount(getSavedCustomTemplates().length);
  }, [activeTab]);

  // Standard Form State
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

  // Custom Template State & Hook
  const {
    state: customState,
    setStep: setCustomStep,
    setTemplate: setCustomTemplate,
    updateFieldBox,
    updateField,
    addField,
    deleteField,
    confirmConfidence,
    setSelectedFieldKey,
    setFieldValue,
    setValues: setCustomValues,
    restoreRevision,
  } = useCustomTemplate();

  const { analyze: runAiAnalysis, isAnalyzing } = useTemplateAnalysis();
  const {
    isRedesigning,
    redesignProgress,
    redesignError,
    redesignNotice,
    redesignTemplate,
  } = useLayoutRedesign();

  const [issuerHint, setIssuerHint] = useState('');
  const [quickEditorOpen, setQuickEditorOpen] = useState(false);
  const [redesignModalOpen, setRedesignModalOpen] = useState(false);
  const [redesignChatPrompt, setRedesignChatPrompt] = useState('');
  const [candidateRedesign, setCandidateRedesign] = useState<CertificateTemplate | null>(null);
  const [candidateIssues, setCandidateIssues] = useState<string[]>([]);
  const [customRecipientWallet, setCustomRecipientWallet] = useState('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const [customIssueStage, setCustomIssueStage] = useState<CustomIssueStage>('idle');
  const [customIssueError, setCustomIssueError] = useState<string | null>(null);
  const [customErrorDetails, setCustomErrorDetails] = useState<CustomErrorDetails | null>(null);
  const [customTxHash, setCustomTxHash] = useState<string | null>(null);
  const [customIssuedCertId, setCustomIssuedCertId] = useState<string | null>(null);
  const [customTemplateCid, setCustomTemplateCid] = useState<string | null>(null);
  const [customBaseCid, setCustomBaseCid] = useState<string | null>(null);
  const [customRenderedCid, setCustomRenderedCid] = useState<string | null>(null);

  // Standard Tx Lifecycle State
  const [standardTxStep, setStandardTxStep] = useState<TxStep>('idle');
  const [standardTxHash, setStandardTxHash] = useState<string | undefined>();
  const [standardConfirmations, setStandardConfirmations] = useState<number>(0);
  const [standardTxError, setStandardTxError] = useState<string | undefined>();
  const [standardIssuedCertId, setStandardIssuedCertId] = useState<string | undefined>();

  // Live computed proofHash for standard preview
  const [previewHash, setPreviewHash] = useState<string>('0x...');

  // Check authorization
  useEffect(() => {
    let isMounted = true;
    if (account) {
      const isOwnerDeployer =
        account.toLowerCase() === '0x637E12782f529c659D8bcF3758ceDCEE92340293'.toLowerCase() ||
        account.toLowerCase() === '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();

      if (isOwnerDeployer) {
        setIsAuthorized(true);
        setCheckingAuth(false);
        return;
      }

      setCheckingAuth(true);
      isIssuerAuthorized(account)
        .then((auth) => {
          if (isMounted) setIsAuthorized(auth);
        })
        .catch(() => {
          if (isMounted) setIsAuthorized(false);
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
  }, [account, chainId, isIssuerAuthorized]);

  // Standard Metadata construction
  const standardMetadata: CertificateMetadata = useMemo(() => {
    const additionalMap: Record<string, string> = {};
    formData.additionalFields.forEach((f) => {
      if (f.key.trim()) additionalMap[f.key.trim()] = f.value.trim();
    });

    return {
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
  }, [formData, account]);

  // Live hash calculation for preview
  useEffect(() => {
    let isCancelled = false;
    computeProofHash(standardMetadata)
      .then((h) => {
        if (!isCancelled) setPreviewHash(h);
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [standardMetadata]);

  // Handler: Standard Field Changes
  const handleStandardFieldChange = (key: keyof IssuanceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleStandardAdditionalChange = (index: number, key: string, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.additionalFields];
      updated[index] = { key, value };
      return { ...prev, additionalFields: updated };
    });
  };

  const addStandardAdditional = () => {
    setFormData((prev) => ({
      ...prev,
      additionalFields: [...prev.additionalFields, { key: '', value: '' }],
    }));
  };

  const removeStandardAdditional = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      additionalFields: prev.additionalFields.filter((_, i) => i !== index),
    }));
  };

  // Handler: File Uploaded in Custom Stepper (Step 1 -> Step 2)
  const handleCustomTemplateUploaded = async (payload: UploadedTemplatePayload) => {
    showToast('info', 'Analyzing Template', 'Running AI field detection on certificate layout...');
    try {
      const analyzedTemplate = await runAiAnalysis({
        imageDataUrl: payload.previewDataUrl,
        width: payload.width,
        height: payload.height,
        templateHash: payload.templateHash,
        mimeType: payload.mimeType,
        issuerHint,
      });

      setCustomTemplate(analyzedTemplate, 'ai_analysis', 'AI Field Detection');
      setCustomStep('detection');
      showToast('success', 'Analysis Complete', `Detected ${analyzedTemplate.fields.length} variable fields.`);
    } catch (err: unknown) {
      console.error('AI analysis error:', err);
    }
  };

  // Handler: Re-run AI Analysis with Hint
  const handleReAnalyze = async () => {
    if (!customState.template || !customState.template.previewDataUrl) return;
    showToast('info', 'Re-analyzing', 'Updating field detection with issuer hint...');
    try {
      const analyzed = await runAiAnalysis({
        imageDataUrl: customState.template.previewDataUrl,
        width: customState.template.widthPx,
        height: customState.template.heightPx,
        templateHash: customState.template.templateHash,
        mimeType: customState.template.mimeType,
        issuerHint,
      });

      setCustomTemplate(analyzed, 'ai_analysis', 'Re-analyzed with Hint');
      showToast('success', 'Updated Layout', `Schema updated with ${analyzed.fields.length} fields.`);
    } catch (err) {
      showToast('error', 'Analysis Failed', 'Could not complete re-analysis.');
    }
  };

  // Handler: Trigger AI Layout Redesign
  const handleStartRedesign = async (promptOverride?: string) => {
    if (!customState.template || !customState.template.previewDataUrl) return;
    showToast('info', 'AI Redesigning', 'Analyzing OCR lines & planning clean template layout...');
    const result = await redesignTemplate(customState.template, promptOverride || redesignChatPrompt);
    if (result) {
      setCandidateRedesign(result.updatedTemplate);
      setCandidateIssues(result.issues);
      setRedesignModalOpen(true);
      showToast('success', 'Redesign Ready', 'Review the before/after comparison below.');
    } else {
      showToast('error', 'Redesign Failed', 'Unable to synthesize new layout plan.');
    }
  };

  const handleAcceptRedesign = () => {
    if (!candidateRedesign) return;
    setCustomTemplate(candidateRedesign, 'ai_redesign', 'AI Layout Redesign');
    setRedesignModalOpen(false);
    showToast('success', 'Redesign Applied', 'Template background cleaned and layout updated.');
  };

  // Standard Issuance Pipeline
  const handleStandardIssue = async () => {
    if (!isConnected || !account) {
      setWalletModalOpen(true);
      showToast('warning', 'Wallet Connection Required', 'Please connect an authorized issuer wallet.');
      return;
    }

    setStandardTxError(undefined);
    setStandardTxHash(undefined);
    setStandardConfirmations(0);

    try {
      const activeChain = chainId || getDefaultChainId();
      if (!SUPPORTED_CHAINS[activeChain]) {
        throw new Error(`Wallet network (Chain ID: ${activeChain}) is not supported.`);
      }

      setStandardTxStep('validating');
      const validation = validateAndSanitizeMetadata(standardMetadata);
      if (!validation.isValid || !validation.sanitizedData) {
        throw new Error(validation.errors.join(' '));
      }

      const finalMetadata = validation.sanitizedData;
      const recipientOnChain = formData.recipientAddress.trim() || ethers.ZeroAddress;

      setStandardTxStep('hashing');
      const proofHash = await computeProofHash(finalMetadata);

      setStandardTxStep('pinning');
      const metadataToPin: CertificateMetadata = { ...finalMetadata, issuedProofHash: proofHash };
      const pinResult = await pinMetadataToIpfs(metadataToPin);

      setStandardTxStep('awaiting_signature');
      showToast('info', 'Signature Required', 'Please confirm the transaction in your wallet.');

      const result = await issueCertificate(proofHash, pinResult.metadataUrl, recipientOnChain);

      setStandardTxHash(result.txHash);
      setStandardTxStep('mining');
      setStandardConfirmations(1);

      const computedCertId = proofHash;

      setStandardIssuedCertId(computedCertId);
      setStandardTxStep('confirmed');
      showToast('success', 'Certificate Issued!', `Anchored on-chain with ID: ${computedCertId.slice(0, 10)}...`);

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const recordsKey = `certichain_records_${activeChain}`;
          const existingRecords = JSON.parse(window.localStorage.getItem(recordsKey) || '[]');
          const newRecord = {
            certId: computedCertId,
            proofHash,
            recipient: recipientOnChain,
            metadataUrl: pinResult.metadataUrl,
            ipfsHash: pinResult.ipfsHash,
            issuedAt: Math.floor(Date.now() / 1000),
            isRevoked: false,
            metadata: metadataToPin,
          };
          window.localStorage.setItem(recordsKey, JSON.stringify([newRecord, ...existingRecords]));
        } catch {
          // ignore quota
        }
      }
    } catch (err: unknown) {
      setStandardTxStep('error');
      const msg = err instanceof Error ? err.message : String(err);
      setStandardTxError(msg);
      showToast('error', 'Issuance Failed', msg);
    }
  };

  // Custom Template Issuance Pipeline
  const handleCustomIssue = async () => {
    if (!isConnected || !account) {
      setWalletModalOpen(true);
      showToast('warning', 'Wallet Connection Required', 'Please connect an authorized issuer wallet.');
      return;
    }

    if (!customState.template) {
      showToast('error', 'Template Missing', 'Please upload and configure a certificate template.');
      return;
    }

    setCustomIssueError(null);
    setCustomErrorDetails(null);
    setCustomTxHash(null);
    setCustomIssuedCertId(null);

    try {
      const activeChain = chainId || getDefaultChainId();
      if (!SUPPORTED_CHAINS[activeChain]) {
        throw new Error(`Wallet network (Chain ID: ${activeChain}) is not supported.`);
      }

      // Step 1: Pin original template file (idempotent resume)
      let templateCid = customTemplateCid;
      if (!templateCid) {
        setCustomIssueStage('uploading_template');
        showToast('info', 'Pinning Template', 'Uploading original template file to IPFS...');

        const pinTemplateRes = await pinBinaryToIpfs({
          fileBase64: customState.template.previewDataUrl || '',
          fileName: 'certificate-template',
          mimeType: customState.template.mimeType,
          expectedHash: customState.template.templateHash,
        });
        templateCid = pinTemplateRes.ipfsHash;
        setCustomTemplateCid(templateCid);
      }

      // Step 1.5: If cleaned base template exists (AI Redesign), pin base image
      let baseCid: string | undefined = customBaseCid || undefined;
      if (!baseCid && customState.template.cleanedBaseDataUrl) {
        try {
          const pinBaseRes = await pinBinaryToIpfs({
            fileBase64: customState.template.cleanedBaseDataUrl,
            fileName: 'cleaned-base-template.png',
            mimeType: 'image/png',
            expectedHash: customState.template.baseHash,
          });
          baseCid = pinBaseRes.ipfsHash;
          setCustomBaseCid(baseCid);
        } catch (baseErr) {
          console.warn('[handleCustomIssue] Cleaned base pin fallback:', baseErr);
        }
      }

      // Step 2: Compute preliminary metadata & layoutHash for deterministic certId
      const layoutHash = await computeLayoutHash(customState.template.fields);
      const resolved = resolveCustomCertificateInfo({}, customState.values);
      const recipientName = resolved.recipientName || 'Recipient';
      const certificateTitle = resolved.certificateTitle || 'Certificate';
      let issueDateVal = new Date().toISOString();
      if (resolved.issueDateStr) {
        const isoMatch = resolved.issueDateStr.match(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/);
        const dateToParse = isoMatch ? isoMatch[0] : resolved.issueDateStr;
        const parsed = new Date(dateToParse);
        if (!isNaN(parsed.getTime())) {
          issueDateVal = parsed.toISOString();
        }
      }

      const preliminaryMetadata: CertificateMetadata = {
        schemaVersion: '1.0',
        certificateTitle,
        recipientName,
        recipientIdentifier: customRecipientWallet,
        issuerName: customState.values.issuerName || 'Decentralized Academic Consortium',
        issuerAddress: account,
        issueDate: issueDateVal,
        expiryDate: null,
        description: resolved.description || 'Verified via CertiChain custom template.',
        custom: {
          schemaVersion: 1,
          templateHash: customState.template.templateHash,
          templateCid,
          ...(baseCid ? { baseCid, baseHash: customState.template.baseHash } : {}),
          layoutHash,
          values: customState.values,
        },
      };

      const preliminaryValidation = validateAndSanitizeMetadata(preliminaryMetadata);
      if (!preliminaryValidation.isValid || !preliminaryValidation.sanitizedData) {
        throw new Error(preliminaryValidation.errors.join(' '));
      }

      const deterministicProofHash = await computeProofHash(preliminaryValidation.sanitizedData);

      // Step 3: Render high-resolution PNG with the real deterministic certId & QR code
      setCustomIssueStage('rendering_certificate');
      showToast('info', 'Rendering Certificate', 'Generating deterministic high-res certificate image...');

      const renderRes = await renderCustomCertificateCanvas({
        template: customState.template,
        values: customState.values,
        certId: deterministicProofHash,
      });

      // Step 4: Pin rendered PNG
      let renderedCid = customRenderedCid;
      if (!renderedCid) {
        const pinRenderedRes = await pinBinaryToIpfs({
          fileBase64: renderRes.pngDataUrl,
          fileName: 'rendered-certificate.png',
          mimeType: 'image/png',
          expectedHash: renderRes.renderedHash,
        });
        renderedCid = pinRenderedRes.ipfsHash;
        setCustomRenderedCid(renderedCid);
      }

      // Step 5: Build final metadata with custom block
      setCustomIssueStage('pinning_metadata');
      const finalCustomMetadata: CertificateMetadata = {
        ...preliminaryValidation.sanitizedData,
        custom: {
          ...preliminaryValidation.sanitizedData.custom!,
          renderedCid,
          renderedHash: renderRes.renderedHash,
        },
      };

      const finalValidation = validateAndSanitizeMetadata(finalCustomMetadata);
      if (!finalValidation.isValid || !finalValidation.sanitizedData) {
        throw new Error(finalValidation.errors.join(' '));
      }

      const finalProofHash = await computeProofHash(finalValidation.sanitizedData);

      const metadataToPin = { ...finalValidation.sanitizedData, issuedProofHash: finalProofHash };
      const metadataPinRes = await pinMetadataToIpfs(metadataToPin);

      // Step 6: Smart contract issuance
      setCustomIssueStage('awaiting_signature');
      showToast('info', 'Signature Required', 'Please confirm the transaction in your wallet.');

      const recipientAddr = ethers.isAddress(customRecipientWallet) ? customRecipientWallet : ethers.ZeroAddress;
      const txResult = await issueCertificate(finalProofHash, metadataPinRes.metadataUrl, recipientAddr);

      setCustomTxHash(txResult.txHash);
      setCustomIssueStage('confirming_tx');

      await txResult.wait(1);

      const computedCertId = finalProofHash;

      setCustomIssuedCertId(computedCertId);
      setCustomIssueStage('confirmed');
      showToast('success', 'Custom Certificate Anchored!', `Credential issued on-chain with ID: ${computedCertId.slice(0, 10)}...`);

      // Auto-save template to Saved Templates library
      try {
        const resolvedInfo = resolveCustomCertificateInfo({}, customState.values);
        saveSavedCustomTemplate(
          customState.template,
          resolvedInfo.certificateTitle || 'Custom Certificate Template',
          customState.values,
          customRecipientWallet
        );
        setSavedTemplatesCount(getSavedCustomTemplates().length);
        showToast('info', 'Template Saved', 'Saved to your templates library for one-click re-issuance.');
      } catch (saveErr) {
        console.warn('Failed to auto-save template to library:', saveErr);
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const recordsKey = `certichain_records_${activeChain}`;
          const existingRecords = JSON.parse(window.localStorage.getItem(recordsKey) || '[]');
          const newRecord = {
            certId: computedCertId,
            proofHash: finalProofHash,
            recipient: recipientAddr,
            metadataUrl: metadataPinRes.metadataUrl,
            ipfsHash: metadataPinRes.ipfsHash,
            issuedAt: Math.floor(Date.now() / 1000),
            isRevoked: false,
            metadata: metadataToPin,
            templateDataUrl: customState.template?.previewDataUrl,
            renderedDataUrl: renderRes?.pngDataUrl,
            baseDataUrl: customState.template?.cleanedBaseDataUrl,
          };

          // Also cache binary artifacts under their CIDs for instant local verification
          if (templateCid && customState.template?.previewDataUrl) {
            try {
              window.localStorage.setItem(`certichain_ipfs_${templateCid}`, customState.template.previewDataUrl);
              window.localStorage.setItem(templateCid, customState.template.previewDataUrl);
            } catch {}
          }
          if (renderedCid && renderRes?.pngDataUrl) {
            try {
              window.localStorage.setItem(`certichain_ipfs_${renderedCid}`, renderRes.pngDataUrl);
              window.localStorage.setItem(renderedCid, renderRes.pngDataUrl);
            } catch {}
          }
          if (baseCid && customState.template?.cleanedBaseDataUrl) {
            try {
              window.localStorage.setItem(`certichain_ipfs_${baseCid}`, customState.template.cleanedBaseDataUrl);
              window.localStorage.setItem(baseCid, customState.template.cleanedBaseDataUrl);
            } catch {}
          }

          window.localStorage.setItem(recordsKey, JSON.stringify([newRecord, ...existingRecords]));
        } catch {
          // ignore quota
        }
      }
    } catch (err: unknown) {
      setCustomIssueStage('error');
      if (err instanceof PinError) {
        setCustomIssueError(err.message);
        setCustomErrorDetails({
          code: err.code,
          technicalDetail: err.technicalDetail,
          requestId: err.requestId,
          statusCode: err.statusCode,
        });
        showToast('error', `IPFS Pinning Failed (${err.code})`, err.message);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setCustomIssueError(msg);
        setCustomErrorDetails({
          code: 'GENERIC_PIPELINE_ERROR',
          technicalDetail: msg,
        });
        showToast('error', 'Issuance Failed', msg);
      }
    }
  };

  const handleManualSaveTemplate = () => {
    if (!customState.template) return;
    try {
      const resolvedInfo = resolveCustomCertificateInfo({}, customState.values);
      saveSavedCustomTemplate(
        customState.template,
        resolvedInfo.certificateTitle || 'Custom Certificate Template',
        customState.values,
        customRecipientWallet
      );
      setSavedTemplatesCount(getSavedCustomTemplates().length);
      showToast('success', 'Template Saved', 'Saved to your templates library.');
    } catch (err) {
      showToast('error', 'Failed to save template', String(err));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-extrabold text-navy-950 dark:text-white tracking-tight">
            Issue Verifiable Credential
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Issue tamper-evident credentials using standard institutional certificates, custom visual templates, or saved layouts.
          </p>
        </div>

        {/* Whitelist Status Badge */}
        {isConnected && (
          <div className="flex items-center gap-2">
            {checkingAuth ? (
              <span className="text-xs text-slate-500 font-medium">Checking authorization...</span>
            ) : isAuthorized ? (
              <div className="badge-valid px-3 py-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Authorized Issuer</span>
              </div>
            ) : (
              <div className="badge-tampered px-3 py-1.5 flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Issuer Whitelist Required</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Segmented Tab Switcher: [ Standard Certificate | Custom Certificate | Saved Templates ] */}
      <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center max-w-xl mx-auto shadow-sm border border-slate-200/80 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveTab('standard')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'standard'
              ? 'bg-white dark:bg-slate-900 text-navy-950 dark:text-white shadow-md'
              : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Layout className="w-4 h-4" />
          <span className="hidden sm:inline">Standard Certificate</span>
          <span className="sm:hidden">Standard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('custom')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'custom'
              ? 'bg-white dark:bg-slate-900 text-azure-600 dark:text-azure-400 shadow-md'
              : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Custom Certificate</span>
          <span className="sm:hidden">Custom</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('saved')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'saved'
              ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-md'
              : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span className="hidden sm:inline">Saved Templates</span>
          <span className="sm:hidden">Saved</span>
          {savedTemplatesCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold">
              {savedTemplatesCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB A: STANDARD INSTITUTIONAL CERTIFICATE */}
      {activeTab === 'standard' && (
        <div className="space-y-6">
          <TransactionStatus
            step={standardTxStep}
            txHash={standardTxHash}
            confirmations={standardConfirmations}
            error={standardTxError}
            certId={standardIssuedCertId}
            onReset={() => {
              setStandardTxStep('idle');
              setStandardTxError(undefined);
              setStandardTxHash(undefined);
            }}
            onViewCertificate={(id) => onNavigateToVerify(id)}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-card">
              <StandardIssueForm
                formData={formData}
                onChangeField={handleStandardFieldChange}
                onChangeAdditionalField={handleStandardAdditionalChange}
                onAddAdditionalField={addStandardAdditional}
                onRemoveAdditionalField={removeStandardAdditional}
              />

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 py-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-azure-600" />
                    <span>Target:</span>
                    <strong className="text-navy-950 dark:text-white font-bold">{activeChainDetails.name}</strong>
                  </span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">
                    Registry: {activeRegistryAddress ? `${activeRegistryAddress.slice(0, 6)}...${activeRegistryAddress.slice(-4)}` : 'None'}
                  </span>
                </div>

                {!isConnected && (
                  <div className="p-3 rounded-xl bg-navy-50 border border-navy-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-navy-900 font-medium">
                      <Wallet className="w-4 h-4 text-azure-700 shrink-0" />
                      <span>Connect with 1-Click Dev Account or MetaMask</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWalletModalOpen(true)}
                      className="text-xs font-bold text-navy-900 hover:underline"
                    >
                      Connect
                    </button>
                  </div>
                )}

                <button
                  onClick={handleStandardIssue}
                  disabled={['validating', 'hashing', 'pinning', 'awaiting_signature', 'mining'].includes(standardTxStep)}
                  className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isConnected ? 'Anchor & Issue Certificate On-Chain' : 'Connect Wallet & Issue On-Chain'}</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
                <span>Live Interactive Preview</span>
                <span className="font-mono text-navy-900 dark:text-azure-400 font-bold">
                  Proof Hash: {previewHash.slice(0, 10)}...
                </span>
              </div>

              <CertificateView
                metadata={standardMetadata}
                mode="editor"
                proofHash={previewHash}
                isAuthorizedIssuer={isAuthorized ?? true}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB B: CUSTOM CERTIFICATE (4-STEP STEPPER) */}
      {activeTab === 'custom' && (
        <div className="space-y-6">
          {/* 4-Step Stepper Navigation Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {[
                { step: 'upload', label: '1. Upload Design', desc: 'Ingest & Hash' },
                { step: 'detection', label: '2. Field Detection', desc: 'AI Vision & Boxes' },
                { step: 'fill', label: '3. Fill & Preview', desc: 'Dynamic Form' },
                { step: 'edit_issue', label: '4. Edit & Issue', desc: 'Canva / Figma / Anchor' },
              ].map((s, idx) => {
                const isActive = customState.step === s.step;
                const isPassed =
                  (s.step === 'upload' && customState.template !== null) ||
                  (s.step === 'detection' && ['fill', 'edit_issue'].includes(customState.step)) ||
                  (s.step === 'fill' && customState.step === 'edit_issue');

                return (
                  <button
                    key={s.step}
                    type="button"
                    disabled={!customState.template && s.step !== 'upload'}
                    onClick={() => setCustomStep(s.step as CustomStepperStep)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-azure-50 dark:bg-azure-950/50 border border-azure-300 dark:border-azure-800 text-azure-950 dark:text-azure-200'
                        : isPassed
                        ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        : 'text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isActive
                          ? 'bg-azure-600 text-white shadow-sm'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">{s.label}</div>
                      <div className="text-[10px] text-slate-400 hidden sm:block">{s.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 1: UPLOAD */}
          {customState.step === 'upload' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <TemplateUploader onTemplateUploaded={handleCustomTemplateUploaded} isProcessing={isAnalyzing} />
            </div>
          )}

          {/* STEP 2: FIELD DETECTION */}
          {customState.step === 'detection' && customState.template && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={issuerHint}
                    onChange={(e) => setIssuerHint(e.target.value)}
                    placeholder="Optional hint for AI (e.g. 'Signatures are on bottom right, grade is A+')..."
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white w-64 sm:w-80 focus:outline-none focus:border-azure-500"
                  />
                  <button
                    type="button"
                    onClick={handleReAnalyze}
                    disabled={isAnalyzing || isRedesigning}
                    className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    <span>Re-Analyze</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartRedesign()}
                    disabled={isAnalyzing || isRedesigning}
                    className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 bg-gradient-to-r from-azure-600/10 to-indigo-600/10 border-azure-300 dark:border-azure-800 text-azure-700 dark:text-azure-300 font-bold"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-azure-600 ${isRedesigning ? 'animate-spin' : ''}`} />
                    <span>{isRedesigning ? redesignProgress || 'Redesigning...' : 'Redesign Layout with AI'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCustomStep('fill')}
                  className="btn-primary text-xs flex items-center gap-1.5 py-2"
                >
                  <span>Confirm Fields & Proceed to Fill</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {(redesignNotice || redesignError) && (
                <div className={`p-3 border rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
                  redesignError
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}>
                  <AlertCircle className={`w-4 h-4 shrink-0 ${redesignError ? 'text-rose-600' : 'text-amber-600'}`} />
                  <span>{redesignError || redesignNotice}</span>
                </div>
              )}

              {/* AI Layout Redesign Review Modal */}
              {redesignModalOpen && candidateRedesign && (
                <div className="bg-white dark:bg-slate-900 border-2 border-azure-500 rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2 text-navy-950 dark:text-white font-bold text-sm">
                      <Sparkles className="w-4 h-4 text-azure-600" />
                      <span>AI Layout Redesign Review & Refinement</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRedesignModalOpen(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Before/After Split Comparison Slider */}
                  <BeforeAfterSlider
                    originalDataUrl={customState.template.previewDataUrl || ''}
                    redesignedDataUrl={candidateRedesign.cleanedBaseDataUrl || candidateRedesign.previewDataUrl || ''}
                    widthPx={customState.template.widthPx}
                    heightPx={customState.template.heightPx}
                  />

                  {candidateIssues.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Layout Notes & Warnings:</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                        {candidateIssues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Redesign Chat Refinement Controls */}
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-bold text-navy-950 dark:text-white">
                      Refine Layout with AI Prompt:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={redesignChatPrompt}
                        onChange={(e) => setRedesignChatPrompt(e.target.value)}
                        placeholder="e.g. 'make recipient name larger and center the dates', 'add a gold accent color'..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-azure-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleStartRedesign(redesignChatPrompt);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleStartRedesign(redesignChatPrompt)}
                        disabled={isRedesigning}
                        className="btn-secondary text-xs shrink-0 py-2 px-3"
                      >
                        {isRedesigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Regenerate'}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-400">Quick Styles:</span>
                      <button
                        type="button"
                        onClick={() => handleStartRedesign('Classic serif academic layout with centered recipient name and formal phrasing')}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] hover:border-azure-500 font-medium"
                      >
                        🎓 Classic Academic
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartRedesign('Modern clean sans-serif layout with high contrast recipient highlight')}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] hover:border-azure-500 font-medium"
                      >
                        ✨ Modern Tech
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartRedesign('Minimalist layout with generous whitespace')}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] hover:border-azure-500 font-medium"
                      >
                        🌿 Minimalist
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setRedesignModalOpen(false)}
                      className="btn-secondary text-xs py-2 px-4"
                    >
                      Keep Original
                    </button>

                    <button
                      type="button"
                      onClick={handleAcceptRedesign}
                      className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept & Apply Redesign</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8">
                  <FieldCanvas
                    template={customState.template}
                    selectedFieldKey={customState.selectedFieldKey}
                    onSelectField={setSelectedFieldKey}
                    onUpdateFieldBox={updateFieldBox}
                    onAddField={addField}
                    onDeleteField={deleteField}
                    onConfirmConfidence={confirmConfidence}
                  />
                </div>

                <div className="lg:col-span-4">
                  <FieldInspector
                    fields={customState.template.fields}
                    selectedFieldKey={customState.selectedFieldKey}
                    onSelectField={setSelectedFieldKey}
                    onUpdateField={updateField}
                    onDeleteField={deleteField}
                    onConfirmConfidence={confirmConfidence}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: FILL AND PREVIEW */}
          {customState.step === 'fill' && customState.template && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCustomStep('detection')}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Field Layout</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualSaveTemplate}
                    className="btn-secondary text-xs flex items-center gap-1.5 py-2 text-amber-600 dark:text-amber-400 hover:border-amber-400"
                    title="Save current template configuration to your library"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Save Template</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomStep('edit_issue')}
                    className="btn-primary text-xs flex items-center gap-1.5 py-2"
                  >
                    <span>Proceed to Design Tools & Issuance</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-5">
                  <DynamicForm
                    template={customState.template}
                    values={customState.values}
                    onValueChange={setFieldValue}
                    recipientWalletAddress={customRecipientWallet}
                    onRecipientWalletChange={setCustomRecipientWallet}
                    onFocusField={setSelectedFieldKey}
                  />
                </div>

                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
                    <span>Live Pixel-Accurate Preview</span>
                    <span className="font-mono text-azure-600 font-bold">
                      {customState.template.fields.length} dynamic slots
                    </span>
                  </div>

                  <TemplatePreview
                    template={customState.template}
                    values={customState.values}
                    certId={customIssuedCertId || undefined}
                    proofHash="0xLivePreview"
                    showExportButtons={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: EDIT AND ISSUE */}
          {customState.step === 'edit_issue' && customState.template && (
            <div className="space-y-6">
              <IssueProgress
                stage={customIssueStage}
                error={customIssueError}
                errorDetails={customErrorDetails}
                txHash={customTxHash}
                certId={customIssuedCertId}
                templateCid={customTemplateCid}
                baseCid={customBaseCid}
                renderedCid={customRenderedCid}
                onRetry={handleCustomIssue}
                onViewCertificate={(id) => onNavigateToVerify(id)}
              />

              <EditorProviderPicker
                template={customState.template}
                onOpenQuickEditor={() => setQuickEditorOpen(true)}
                onImportEditedTemplate={(updated, source) => setCustomTemplate(updated, 'manual_edit', source)}
              />

              <RevisionTimeline
                revisions={customState.revisions}
                activeRevisionId={customState.activeRevisionId}
                onRestoreRevision={restoreRevision}
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-5 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-card">
                  <h4 className="font-serif font-bold text-sm text-navy-950 dark:text-white">
                    Ready to Anchor on Blockchain
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Your template, high-resolution rendered PNG, and cryptographic canonical metadata will all be pinned to IPFS and immutably anchored on EVM.
                  </p>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1.5 text-xs font-mono text-slate-700 dark:text-slate-300">
                    <div>Template Hash: <span className="text-slate-500">{customState.template.templateHash.slice(0, 16)}...</span></div>
                    <div>Recipient: <span className="text-slate-500">{customRecipientWallet.slice(0, 16)}...</span></div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={handleCustomIssue}
                      disabled={['uploading_template', 'rendering_certificate', 'pinning_metadata', 'awaiting_signature', 'confirming_tx'].includes(customIssueStage)}
                      className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Anchor & Issue Custom Certificate On-Chain</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleManualSaveTemplate}
                      className="btn-secondary w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 hover:border-amber-400"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Save as Template for Later</span>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <TemplatePreview
                    template={customState.template}
                    values={customState.values}
                    certId={customIssuedCertId || undefined}
                    showExportButtons={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Built-in Quick Editor Full-Screen Modal */}
          {quickEditorOpen && customState.template && (
            <QuickEditor
              template={customState.template}
              onSave={(updated) => {
                setCustomTemplate(updated, 'quick_edit', 'Quick Editor Customization');
                setQuickEditorOpen(false);
                showToast('success', 'Changes Saved', 'Updated template layout and typography.');
              }}
              onClose={() => setQuickEditorOpen(false)}
            />
          )}
        </div>
      )}

      {/* TAB C: SAVED TEMPLATES */}
      {activeTab === 'saved' && (
        <SavedTemplatesGallery
          onSelectTemplateForIssuance={(template, initialValues, recipientWallet) => {
            const resolved = resolveCustomCertificateInfo({}, initialValues || {});
            setCustomTemplate(template, 'manual_edit', resolved.certificateTitle || 'Saved Template');
            if (initialValues) {
              setCustomValues(initialValues);
            }
            if (recipientWallet) {
              setCustomRecipientWallet(recipientWallet);
            }
            setCustomStep('fill');
            setActiveTab('custom');
            showToast('info', 'Template Loaded', 'Fill recipient details and preview live before issuing.');
          }}
          onSelectTemplateForEditing={(template) => {
            const resolved = resolveCustomCertificateInfo({});
            setCustomTemplate(template, 'manual_edit', resolved.certificateTitle || 'Saved Template');
            setCustomStep('detection');
            setActiveTab('custom');
            showToast('info', 'Template Loaded', 'Adjust bounding boxes, typography, or QR placement.');
          }}
          onCreateNewTemplate={() => {
            setCustomStep('upload');
            setActiveTab('custom');
          }}
        />
      )}

      {/* Wallet Modal */}
      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
};
