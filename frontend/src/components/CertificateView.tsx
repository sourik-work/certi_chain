import React from 'react';
import { CertificateMetadata } from '../types/certificate';
import { TemplateSpec } from '../lib/template/types';
import { CertificatePreview } from './CertificatePreview';
import { TemplateRenderer } from './template/TemplateRenderer';
import { CustomCertificatePreview } from './CustomCertificatePreview';

export interface CertificateViewProps {
  metadata: Partial<CertificateMetadata>;
  templateSpec?: TemplateSpec | null;
  templateValues?: Record<string, string>;
  renderedDataUrl?: string;
  mode?: 'editor' | 'issued';
  proofHash?: string;
  certId?: string;
  isRevoked?: boolean;
  revocationReason?: string;
  revocationTimestamp?: bigint;
  isAuthorizedIssuer?: boolean;
  showExportControls?: boolean;
  highlightFieldKey?: string | null;
  id?: string;
  className?: string;
}

export const CertificateView: React.FC<CertificateViewProps> = ({
  metadata,
  templateSpec,
  templateValues,
  renderedDataUrl,
  mode = 'issued',
  proofHash,
  certId,
  isRevoked = false,
  revocationReason,
  revocationTimestamp,
  isAuthorizedIssuer = true,
  showExportControls = true,
  highlightFieldKey = null,
  id,
  className = '',
}) => {
  // 1. If custom certificate and verified renderedDataUrl is present, render CustomCertificatePreview
  if (metadata.custom && renderedDataUrl) {
    return (
      <CustomCertificatePreview
        renderedDataUrl={renderedDataUrl}
        metadata={metadata}
        showExportControls={showExportControls}
        id={id}
        className={className}
      />
    );
  }

  // 2. If template spec is provided (or if metadata contains template values and spec), render TemplateRenderer
  if (templateSpec) {
    const values = templateValues || (metadata.templateValues as Record<string, string>) || {};
    return (
      <TemplateRenderer
        spec={templateSpec}
        values={values}
        mode={mode}
        certId={certId}
        proofHash={proofHash}
        issuerAddress={metadata.issuerAddress}
        isRevoked={isRevoked}
        revocationReason={revocationReason}
        revocationTimestamp={revocationTimestamp}
        highlightFieldKey={highlightFieldKey}
        showExportControls={showExportControls}
        id={id}
        className={className}
      />
    );
  }

  // 3. Otherwise, render classic institutional CertificatePreview
  return (
    <CertificatePreview
      metadata={metadata}
      proofHash={proofHash}
      certId={certId}
      isRevoked={isRevoked}
      revocationReason={revocationReason}
      revocationTimestamp={revocationTimestamp}
      isAuthorizedIssuer={isAuthorizedIssuer}
      showExportControls={showExportControls}
      id={id}
    />
  );
};

