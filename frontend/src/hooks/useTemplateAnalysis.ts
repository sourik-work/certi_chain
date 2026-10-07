/**
 * AI Template Analysis Hook
 * Dispatches template image payload to serverless vision endpoint and handles fallback.
 */

import { useState, useCallback } from 'react';
import type { CertificateTemplate, TemplateField } from '../types/customTemplate';
import { postProcessDetectedFields } from '../lib/templateAnalysis';

export interface AnalyzeTemplateInput {
  imageDataUrl: string;
  width: number;
  height: number;
  templateHash: string;
  mimeType: string;
  issuerHint?: string;
}

export function useTemplateAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (input: AnalyzeTemplateInput): Promise<CertificateTemplate> => {
      setIsAnalyzing(true);
      setError(null);

      try {
        const response = await fetch('/api/analyzeTemplate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (response.ok) {
          const data = await response.json();
          const processedFields = postProcessDetectedFields(data.fields || []);

          return {
            schemaVersion: 1,
            templateHash: input.templateHash,
            mimeType: input.mimeType,
            widthPx: data.widthPx || input.width,
            heightPx: data.heightPx || input.height,
            orientation: data.orientation || (input.width >= input.height ? 'landscape' : 'portrait'),
            fields: processedFields,
            staticTextRegions: data.staticTextRegions || [],
            analysis: data.analysis || {
              model: 'certichain-vision',
              promptVersion: 'v1.0.0',
              analyzedAt: new Date().toISOString(),
            },
            previewDataUrl: input.imageDataUrl,
          };
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${response.status}: Failed to analyze template.`);
        }
      } catch (err) {
        console.warn('AI analysis API unavailable or failed, falling back to foundational detection:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);

        // Fallback: Generate foundational fields so user is never blocked
        const isLandscape = input.width >= input.height;
        const defaultFields: TemplateField[] = [
          {
            key: 'certificateTitle',
            label: 'Certificate Title',
            type: 'text',
            required: true,
            box: { x: 0.2, y: 0.18, w: 0.6, h: 0.08 },
            style: {
              fontFamily: 'Playfair Display',
              fontSize: Math.round(input.height * 0.045),
              fontWeight: 700,
              color: '#1E293B',
              align: 'center',
              letterSpacing: 0.5,
              lineHeight: 1.2,
              minFontSize: 16,
              maxLines: 2,
              uppercase: true,
            },
            sampleText: 'CERTIFICATE OF ACHIEVEMENT',
            confidence: 1.0,
            source: 'issuer',
          },
          {
            key: 'recipientName',
            label: 'Recipient Full Name',
            type: 'name',
            required: true,
            box: { x: 0.2, y: 0.44, w: 0.6, h: 0.09 },
            style: {
              fontFamily: 'Playfair Display',
              fontSize: Math.round(input.height * 0.06),
              fontWeight: 800,
              color: '#0F172A',
              align: 'center',
              letterSpacing: 0,
              lineHeight: 1.1,
              minFontSize: 18,
              maxLines: 1,
              uppercase: false,
            },
            sampleText: 'Alice Nakamoto',
            confidence: 1.0,
            source: 'issuer',
          },
          {
            key: 'courseTitle',
            label: 'Course / Credential Title',
            type: 'longText',
            required: true,
            box: { x: 0.18, y: 0.58, w: 0.64, h: 0.1 },
            style: {
              fontFamily: 'Plus Jakarta Sans',
              fontSize: Math.round(input.height * 0.026),
              fontWeight: 500,
              color: '#334155',
              align: 'center',
              letterSpacing: 0,
              lineHeight: 1.4,
              minFontSize: 14,
              maxLines: 3,
              uppercase: false,
            },
            sampleText: 'For demonstrating outstanding mastery in decentralized cryptographic systems.',
            confidence: 1.0,
            source: 'issuer',
          },
          {
            key: 'issueDate',
            label: 'Date of Issue',
            type: 'date',
            required: true,
            box: { x: 0.15, y: 0.8, w: 0.25, h: 0.05 },
            style: {
              fontFamily: 'Plus Jakarta Sans',
              fontSize: Math.round(input.height * 0.02),
              fontWeight: 500,
              color: '#475569',
              align: 'left',
              letterSpacing: 0,
              lineHeight: 1.2,
              minFontSize: 12,
              maxLines: 1,
              uppercase: false,
            },
            sampleText: new Date().toISOString().split('T')[0],
            confidence: 1.0,
            source: 'issuer',
          },
          {
            key: 'issuerName',
            label: 'Issuer Organization',
            type: 'text',
            required: true,
            box: { x: 0.6, y: 0.8, w: 0.25, h: 0.05 },
            style: {
              fontFamily: 'Plus Jakarta Sans',
              fontSize: Math.round(input.height * 0.02),
              fontWeight: 600,
              color: '#0F172A',
              align: 'right',
              letterSpacing: 0,
              lineHeight: 1.2,
              minFontSize: 12,
              maxLines: 1,
              uppercase: false,
            },
            sampleText: 'Decentralized Academic Consortium',
            confidence: 1.0,
            source: 'issuer',
          },
        ];

        return {
          schemaVersion: 1,
          templateHash: input.templateHash,
          mimeType: input.mimeType,
          widthPx: input.width,
          heightPx: input.height,
          orientation: isLandscape ? 'landscape' : 'portrait',
          fields: defaultFields,
          staticTextRegions: [],
          analysis: {
            model: 'manual-fallback',
            promptVersion: 'v1.0.0',
            analyzedAt: new Date().toISOString(),
          },
          previewDataUrl: input.imageDataUrl,
        };
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  return { analyze, isAnalyzing, error };
}
