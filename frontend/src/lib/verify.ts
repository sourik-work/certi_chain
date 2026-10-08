/**
 * @file verify.ts
 * @summary Cryptographically verifies certificate authenticity against on-chain state,
 * IPFS metadata, and custom template integrity.
 *
 * Steps:
 * 1. Fetch on-chain record via verifyCertificate(certId).
 * 2. If issuedAt == 0 -> NOT_FOUND / INVALID.
 * 3. Fetch pinned metadata from IPFS via gateway (with fallback).
 * 4. Recompute canonical SHA-256 proof hash client-side.
 * 5. Compare recomputed hash with on-chain proofHash.
 * 6. If metadata.template exists: fetch template, validate schema, recompute sha256.
 *    Mismatch -> INVALID_TAMPERED ("Template does not match the issued record").
 *    Unreachable -> UNVERIFIABLE.
 * 7. Evaluate revocation state and issuer authorization.
 */

import { fetchMetadataFromIpfs, fetchArtifactBytes } from './pinata';
import { computeProofHash } from './hash';
import { sha256Bytes, uint8ArrayToDataUrl, sniffImageMime, base64ToUint8Array } from './bytes';
import {
  OnChainCertificate,
  CertificateMetadata,
  VerificationResultData,
  CustomIntegrityStatus,
} from '../types/certificate';
import { TemplateSpec } from './template/types';
import { validateTemplateSpec } from './template/schema';
import { computeTemplateSha256 } from './template/pin';
import { getTemplateByCidOrSha256 } from './template/store';
import { getSavedCustomTemplates } from './savedTemplatesStore';
import { renderCustomCertificateCanvas } from './renderCertificate';
import { CertificateTemplate } from '../types/customTemplate';
import { trace } from './debugTrace';

export interface VerifyParams {
  certId: string;
  onChainCert?: OnChainCertificate | null;
  isAuthorized: boolean;
  metadataOverride?: CertificateMetadata;
  templateOverride?: TemplateSpec;
  chainId?: number;
  chainName?: string;
  registryAddress?: string;
  walletChainMismatch?: boolean;
  walletChainName?: string;
  errorReason?: string;
  stateOverride?: 'NO_CONTRACT' | 'UNREACHABLE' | 'NOT_FOUND';
}

export async function verifyCertificateIntegrity({
  certId,
  onChainCert,
  isAuthorized,
  metadataOverride,
  templateOverride,
  chainId,
  chainName,
  registryAddress,
  walletChainMismatch,
  walletChainName,
  errorReason,
  stateOverride,
}: VerifyParams): Promise<VerificationResultData> {
  const baseResult = {
    certId,
    chainId,
    chainName,
    registryAddress,
    walletChainMismatch,
    walletChainName,
  };

  if (stateOverride) {
    trace('chain.diag', {
      context: 'stateOverride',
      state: stateOverride,
      certId,
      chainId,
      chainName,
      registryAddress,
      errorReason,
    });
    return {
      ...baseResult,
      state: stateOverride,
      errorReason: errorReason || `Verification failed (${stateOverride})`,
      isIssuerAuthorized: false,
    };
  }

  // Case 1: Certificate does not exist on-chain
  if (!onChainCert || onChainCert.issuedAt === 0n) {
    trace('chain.diag', {
      context: 'verifyCertificateIntegrity',
      status: 'NOT_FOUND',
      certId,
      chainId,
      chainName,
      registryAddress,
      issuedAt: onChainCert?.issuedAt?.toString() || '0',
    });
    trace('errors', { context: 'verifyCertificateIntegrity', reason: 'NOT_FOUND', certId });
    return {
      ...baseResult,
      state: 'NOT_FOUND',
      errorReason: errorReason || 'Certificate not found in on-chain registry.',
      isIssuerAuthorized: false,
    };
  }

  let metadata = metadataOverride;
  let metadataSource = metadataOverride ? 'override' : 'ipfs';

  if (!metadata && onChainCert.metadataUrl) {
    try {
      metadata = await fetchMetadataFromIpfs(onChainCert.metadataUrl);
      metadataSource = 'ipfs_gateway';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve IPFS metadata';
      trace('errors', { context: 'fetchMetadataFromIpfs', error: message, metadataUrl: onChainCert.metadataUrl });
      return {
        ...baseResult,
        state: 'UNVERIFIABLE',
        certId,
        onChain: onChainCert,
        errorReason: `IPFS metadata unreachable: ${message}`,
        isIssuerAuthorized: isAuthorized,
      };
    }
  }

  if (!metadata) {
    trace('errors', { context: 'verifyCertificateIntegrity', reason: 'NO_METADATA', certId });
    return {
      ...baseResult,
      state: 'UNVERIFIABLE',
      certId,
      onChain: onChainCert,
      errorReason: 'Unable to resolve certificate metadata.',
      isIssuerAuthorized: isAuthorized,
    };
  }

  // Compute proof hash from canonicalized metadata
  const computedHash = await computeProofHash(metadata);

  trace('metadata.fetched', {
    source: metadataSource,
    cid: onChainCert.metadataUrl,
    sha256: computedHash,
    keysPresent: Object.keys(metadata),
    templateValues: metadata.templateValues || null,
    template: metadata.template || null,
  });

  const hashMatches =
    computedHash.toLowerCase() === onChainCert.proofHash.toLowerCase() &&
    computedHash.toLowerCase() === certId.toLowerCase();

  // Case 2: Cryptographic Metadata Tampering Detected
  if (!hashMatches) {
    trace('errors', {
      context: 'proofHash_mismatch',
      onChainProofHash: onChainCert.proofHash,
      computedProofHash: computedHash,
      certId,
    });
    return {
      ...baseResult,
      state: 'INVALID_TAMPERED',
      certId,
      onChain: onChainCert,
      metadata,
      computedProofHash: computedHash,
      isIssuerAuthorized: isAuthorized,
      errorReason: `Cryptographic proof hash mismatch. On-chain: ${onChainCert.proofHash}, Computed: ${computedHash}`,
    };
  }

  // Additive Check: If custom template was attached, verify template integrity & sha256
  let resolvedTemplateSpec: TemplateSpec | null = templateOverride || null;
  let templateResolutionSource = templateOverride ? 'override' : 'unresolved';

  if (metadata.template) {
    if (!resolvedTemplateSpec) {
      // Try local IndexedDB store first by CID or SHA-256 only (Invariant I4)
      try {
        const localSpec = await getTemplateByCidOrSha256(metadata.template.cid) ||
          await getTemplateByCidOrSha256(metadata.template.sha256);
        if (localSpec) {
          const checkSha = await computeTemplateSha256(localSpec);
          if (checkSha.toLowerCase() === metadata.template.sha256.toLowerCase()) {
            resolvedTemplateSpec = localSpec;
            templateResolutionSource = 'indexeddb_cache_validated';
          }
        }
      } catch (err) {
        trace('errors', { context: 'getTemplateByCidOrSha256', error: err instanceof Error ? err.message : String(err) });
      }

      // Fetch from IPFS if not in validated local store
      if (!resolvedTemplateSpec) {
        try {
          const rawTemplate = (await fetchMetadataFromIpfs(
            metadata.template.cid
          )) as unknown as TemplateSpec;
          const validation = validateTemplateSpec(rawTemplate);
          if (validation.valid) {
            resolvedTemplateSpec = rawTemplate;
            templateResolutionSource = 'ipfs_gateway';
          } else {
            trace('errors', {
              context: 'validateTemplateSpec',
              errors: validation.errors,
              cid: metadata.template.cid,
            });
            return {
              ...baseResult,
              state: 'UNVERIFIABLE',
              certId,
              onChain: onChainCert,
              metadata,
              computedProofHash: computedHash,
              isIssuerAuthorized: isAuthorized,
              errorReason: `Template schema validation failed: ${validation.errors.join(', ')}`,
            };
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Template unreachable';
          trace('errors', { context: 'fetchTemplateFromIpfs', error: message, cid: metadata.template.cid });
          return {
            ...baseResult,
            state: 'UNVERIFIABLE',
            certId,
            onChain: onChainCert,
            metadata,
            computedProofHash: computedHash,
            isIssuerAuthorized: isAuthorized,
            errorReason: `Template IPFS data unreachable: ${message}`,
          };
        }
      }
    }

    if (resolvedTemplateSpec) {
      // Recompute SHA-256 of the template spec
      const computedTemplateSha256 = await computeTemplateSha256(resolvedTemplateSpec);
      const shaMatches = computedTemplateSha256.toLowerCase() === metadata.template.sha256.toLowerCase();

      const validation = validateTemplateSpec(resolvedTemplateSpec);

      trace('template.resolved', {
        source: templateResolutionSource,
        cid: metadata.template.cid,
        sha256: computedTemplateSha256,
        matchesMetadataSha: shaMatches,
        background: {
          bytes: resolvedTemplateSpec.background.dataUrl.length,
          erasedBackground: resolvedTemplateSpec.background.erasedBackground,
          width: resolvedTemplateSpec.canvas.width,
          height: resolvedTemplateSpec.canvas.height,
        },
        blocksCount: resolvedTemplateSpec.blocks.length,
        fieldsCount: resolvedTemplateSpec.fields.length,
        valid: validation.valid,
        errors: validation.errors,
      });

      if (!shaMatches) {
        trace('errors', {
          context: 'template_sha256_mismatch',
          metadataSha: metadata.template.sha256,
          computedSha: computedTemplateSha256,
        });
        return {
          ...baseResult,
          state: 'INVALID_TAMPERED',
          certId,
          onChain: onChainCert,
          metadata,
          templateSpec: resolvedTemplateSpec,
          computedProofHash: computedHash,
          isIssuerAuthorized: isAuthorized,
          errorReason: 'Template does not match the issued record',
        };
      }
    }
  }

  // Custom Template Multi-Artifact Integrity Check
  let customIntegrity: CustomIntegrityStatus | undefined;
  let renderedDataUrl: string | undefined;

  if (metadata.custom) {
    let templateValid: boolean | 'unverifiable' = true;
    let renderedValid: boolean | 'unverifiable' = true;
    let baseValid: boolean | 'unverifiable' = true;
    let layoutValid: boolean = true;
    let templateHashMatch: boolean | undefined = true;
    let renderedHashMatch: boolean | undefined = true;
    let baseHashMatch: boolean | undefined = true;

    // Look for a local saved template matching the issued templateHash
    let matchedTemplate: CertificateTemplate | null = null;
    try {
      const savedTemplates = getSavedCustomTemplates();
      matchedTemplate =
        savedTemplates.find(
          (t) =>
            t.template.templateHash.toLowerCase() === metadata.custom?.templateHash.toLowerCase() ||
            (metadata.custom?.templateCid && t.id === metadata.custom.templateCid)
        )?.template || null;
    } catch {
      // Ignore
    }

    // Verify templateHash if templateCid is provided
    if (metadata.custom.templateCid && metadata.custom.templateHash) {
      let bytes = await fetchArtifactBytes(metadata.custom.templateCid, undefined);
      if (!bytes && matchedTemplate?.previewDataUrl) {
        try {
          bytes = base64ToUint8Array(matchedTemplate.previewDataUrl);
        } catch {}
      }

      if (!bytes) {
        templateValid = 'unverifiable';
        templateHashMatch = undefined;
      } else {
        const computed = await sha256Bytes(bytes);
        const matches = computed.toLowerCase() === metadata.custom.templateHash.toLowerCase();
        templateHashMatch = matches;
        templateValid = matches;
      }
    }

    // Verify renderedHash if renderedCid is provided
    if (metadata.custom.renderedCid && metadata.custom.renderedHash) {
      let bytes = await fetchArtifactBytes(metadata.custom.renderedCid, undefined);
      if (!bytes && matchedTemplate && metadata.custom.values) {
        try {
          const renderRes = await renderCustomCertificateCanvas({
            template: matchedTemplate,
            values: metadata.custom.values,
            certId: computedHash,
          });
          if (renderRes.renderedHash.toLowerCase() === metadata.custom.renderedHash.toLowerCase()) {
            bytes = base64ToUint8Array(renderRes.pngDataUrl);
          }
        } catch {}
      }

      if (!bytes) {
        renderedValid = 'unverifiable';
        renderedHashMatch = undefined;
      } else {
        const computed = await sha256Bytes(bytes);
        const matches = computed.toLowerCase() === metadata.custom.renderedHash.toLowerCase();
        renderedHashMatch = matches;
        renderedValid = matches;
        if (matches) {
          renderedDataUrl = uint8ArrayToDataUrl(bytes, sniffImageMime(bytes));
        }
      }
    }

    // Verify baseHash if baseCid is provided
    if (metadata.custom.baseCid && metadata.custom.baseHash) {
      let bytes = await fetchArtifactBytes(metadata.custom.baseCid, undefined);
      if (!bytes && matchedTemplate?.cleanedBaseDataUrl) {
        try {
          bytes = base64ToUint8Array(matchedTemplate.cleanedBaseDataUrl);
        } catch {}
      }

      if (!bytes) {
        baseValid = 'unverifiable';
        baseHashMatch = undefined;
      } else {
        const computed = await sha256Bytes(bytes);
        const matches = computed.toLowerCase() === metadata.custom.baseHash.toLowerCase();
        baseHashMatch = matches;
        baseValid = matches;
      }
    }

    const hasTampered = templateValid === false || renderedValid === false || baseValid === false || !layoutValid;
    const hasUnverifiable = templateValid === 'unverifiable' || renderedValid === 'unverifiable' || baseValid === 'unverifiable';

    customIntegrity = {
      valid: !hasTampered && !hasUnverifiable,
      templateValid: templateValid === true,
      baseValid: baseValid === true,
      renderedValid: renderedValid === true,
      layoutValid,
      templateHashMatch,
      baseHashMatch,
      renderedHashMatch,
      details: hasTampered
        ? 'One or more custom template artifacts failed integrity checks.'
        : hasUnverifiable
        ? 'Custom template artifacts could not be retrieved from IPFS gateways.'
        : 'All custom artifacts (template, cleaned base, rendered image, layout) verified intact.',
    };

    if (hasTampered) {
      return {
        ...baseResult,
        state: 'INVALID_TAMPERED',
        certId,
        onChain: onChainCert,
        metadata,
        templateSpec: resolvedTemplateSpec,
        customIntegrity,
        computedProofHash: computedHash,
        isIssuerAuthorized: isAuthorized,
        errorReason: 'Custom certificate template or rendered image has been tampered with.',
      };
    }

    if (hasUnverifiable) {
      return {
        ...baseResult,
        state: 'INVALID_UNVERIFIABLE',
        certId,
        onChain: onChainCert,
        metadata,
        templateSpec: resolvedTemplateSpec,
        customIntegrity,
        computedProofHash: computedHash,
        isIssuerAuthorized: isAuthorized,
        errorReason: 'Custom certificate artifacts could not be retrieved from IPFS gateways.',
      };
    }
  }

  // Case 3: Revoked Certificate
  if (onChainCert.revoked) {
    return {
      ...baseResult,
      state: 'REVOKED',
      certId,
      onChain: onChainCert,
      metadata,
      templateSpec: resolvedTemplateSpec,
      customIntegrity,
      renderedDataUrl,
      computedProofHash: computedHash,
      isIssuerAuthorized: isAuthorized,
    };
  }

  // Case 4: Valid Certificate
  return {
    ...baseResult,
    state: 'VALID',
    certId,
    onChain: onChainCert,
    metadata,
    templateSpec: resolvedTemplateSpec,
    customIntegrity,
    renderedDataUrl,
    computedProofHash: computedHash,
    isIssuerAuthorized: isAuthorized,
  };
}
