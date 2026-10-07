/**
 * AI Layout Redesign Hook
 * Orchestrates OCR line extraction, AI layout planning (/api/planLayout), base template cleaning,
 * and deterministic layout validation.
 */

import { useState, useCallback } from 'react';
import type { CertificateTemplate, TemplateField } from '../types/customTemplate';
import { extractOcrLines } from '../lib/ocrService';
import { cleanBaseTemplate } from '../lib/cleanBase';
import { validateLayoutPlan } from '../lib/layoutValidator';

export interface UseLayoutRedesignResult {
  isRedesigning: boolean;
  redesignProgress: string | null;
  redesignError: string | null;
  redesignNotice: string | null;
  redesignTemplate: (
    currentTemplate: CertificateTemplate,
    userPrompt?: string
  ) => Promise<{ updatedTemplate: CertificateTemplate; issues: string[] } | null>;
}

export function useLayoutRedesign(): UseLayoutRedesignResult {
  const [isRedesigning, setIsRedesigning] = useState(false);
  const [redesignProgress, setRedesignProgress] = useState<string | null>(null);
  const [redesignError, setRedesignError] = useState<string | null>(null);
  const [redesignNotice, setRedesignNotice] = useState<string | null>(null);

  const redesignTemplate = useCallback(
    async (
      currentTemplate: CertificateTemplate,
      userPrompt?: string
    ): Promise<{ updatedTemplate: CertificateTemplate; issues: string[] } | null> => {
      setIsRedesigning(true);
      setRedesignError(null);
      setRedesignNotice(null);

      try {
        const imageSource = currentTemplate.previewDataUrl;
        if (!imageSource) {
          throw new Error('Template image source is unavailable.');
        }

        // 1. OCR Line Extraction Pass
        setRedesignProgress('Extracting text regions via OCR...');
        const ocrRes = await extractOcrLines(
          imageSource,
          currentTemplate.widthPx,
          currentTemplate.heightPx
        );

        // 2. Call AI Layout Planner (/api/planLayout)
        setRedesignProgress('AI is planning optimal layout & safe zones...');
        const planRes = await fetch('/api/planLayout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imageSource,
            mimeType: currentTemplate.mimeType,
            ocrLines: ocrRes.lines,
            userPrompt: userPrompt || '',
          }),
        });

        if (!planRes.ok) {
          throw new Error(`AI Layout planning failed with status ${planRes.status}`);
        }

        const planData = await planRes.json();
        if (planData.isFallback) {
          setRedesignNotice(
            'Local layout synthesis active (Gemini key not configured or rate-limited). Output is fully functional.'
          );
        }

        const {
          linesToRemove = [],
          safeZones = [],
          newBlocks = [],
        } = planData;

        // Find boxes to erase
        const boxesToErase = ocrRes.lines
          .filter((line) => linesToRemove.includes(line.id))
          .map((l) => l.box);

        // 3. Clean Background Base Template (Erase placeholder lines)
        setRedesignProgress('Cleaning background and erasing placeholder lines...');
        const cleanResult = await cleanBaseTemplate({
          imageSource,
          boxesToRemove: boxesToErase,
          imageWidth: currentTemplate.widthPx,
          imageHeight: currentTemplate.heightPx,
        });

        // 4. Deterministic Layout Validation
        setRedesignProgress('Validating layout constraints and typography...');
        const validation = validateLayoutPlan(
          newBlocks as TemplateField[],
          safeZones,
          currentTemplate.widthPx,
          currentTemplate.heightPx
        );

        const updatedTemplate: CertificateTemplate = {
          ...currentTemplate,
          cleanedBaseDataUrl: cleanResult.cleanedDataUrl,
          baseHash: cleanResult.baseHash,
          safeZones,
          fields: validation.repairedFields,
          analysis: {
            model: planData.analysis?.model || 'ai-redesign',
            promptVersion: planData.analysis?.promptVersion || 'v1.0.0',
            analyzedAt: new Date().toISOString(),
          },
        };

        setRedesignProgress(null);
        return {
          updatedTemplate,
          issues: validation.issues,
        };
      } catch (err) {
        console.error('[useLayoutRedesign] Redesign failed:', err);
        setRedesignError(err instanceof Error ? err.message : 'Layout redesign failed.');
        setRedesignProgress(null);
        return null;
      } finally {
        setIsRedesigning(false);
      }
    },
    []
  );

  return {
    isRedesigning,
    redesignProgress,
    redesignError,
    redesignNotice,
    redesignTemplate,
  };
}
