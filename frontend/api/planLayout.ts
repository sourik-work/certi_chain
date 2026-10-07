/**
 * Serverless AI Layout Redesign Planner Endpoint
 * Route: POST /api/planLayout
 *
 * Accepts template image data and OCR lines, calls Gemini Vision with anti-prompt-injection
 * instructions, validates schema with Zod, normalizes coordinates, and returns lines to remove,
 * lines to keep, safe zones, and redesigned variable/composite blocks.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import {
  PLAN_LAYOUT_SYSTEM_INSTRUCTION,
  PLAN_LAYOUT_PROMPT_VERSION,
} from './prompts/planLayout.v1';
import { checkRateLimit } from './session';
import { geminiBoxToNormalizedBox } from '../src/lib/coordinateNormalizer';
import { snapBox } from '../src/lib/templateAnalysis';

const BoxSchema = z.union([
  z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  z.tuple([z.number(), z.number(), z.number(), z.number()]),
]);

const TokenSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum([
    'text',
    'longText',
    'name',
    'date',
    'number',
    'email',
    'walletAddress',
    'select',
    'signature',
    'logo',
    'qrCode',
    'certId',
    'proofHash',
    'compositeText',
  ]),
  required: z.boolean().optional(),
  sampleValue: z.string().optional(),
});

const StyleSchema = z.object({
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().default(20),
  fontWeight: z.number().default(400),
  color: z.string().default('#111827'),
  align: z.enum(['left', 'center', 'right']).default('center'),
  letterSpacing: z.number().default(0),
  lineHeight: z.number().default(1.4),
  minFontSize: z.number().default(12),
  maxLines: z.number().default(3),
  uppercase: z.boolean().default(false),
});

const BlockSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum([
    'text',
    'longText',
    'name',
    'date',
    'number',
    'email',
    'walletAddress',
    'select',
    'signature',
    'logo',
    'qrCode',
    'certId',
    'proofHash',
    'compositeText',
  ]),
  required: z.boolean().default(true),
  box: BoxSchema.nullable(),
  style: StyleSchema.nullable(),
  sampleText: z.string().optional(),
  confidence: z.number().default(0.9),
  compositeTemplate: z.string().optional(),
  tokens: z.array(TokenSchema).optional(),
});

const LayoutPlanResponseSchema = z.object({
  linesToRemove: z.array(z.string()).default([]),
  linesToKeep: z.array(z.string()).default([]),
  safeZones: z.array(BoxSchema).default([]),
  newBlocks: z.array(BlockSchema).default([]),
  reasoning: z.string().optional(),
});

function parseToNormalizedBox(box: unknown): { x: number; y: number; w: number; h: number } | null {
  if (!box) return null;
  if (Array.isArray(box) && box.length === 4) {
    return geminiBoxToNormalizedBox(box as [number, number, number, number]);
  }
  if (typeof box === 'object' && 'x' in box && 'y' in box && 'w' in box && 'h' in box) {
    const b = box as { x: number; y: number; w: number; h: number };
    return snapBox({
      x: Number(b.x),
      y: Number(b.y),
      w: Number(b.w),
      h: Number(b.h),
    });
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  if (!checkRateLimit(clientIp, 20, 60000)) {
    res.status(429).json({ error: 'Rate limit exceeded for layout planning. Please wait 1 minute.' });
    return;
  }

  try {
    const { imageBase64, mimeType = 'image/png', ocrLines = [], userPrompt = '' } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Missing required imageBase64 payload.' });
      return;
    }

    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'gemini-1.5-flash';

    if (!apiKey) {
      // Graceful fallback synthesizing clean redesigned layout from OCR lines
      const fallbackPlan = generateFallbackLayoutPlan(ocrLines);
      res.status(200).json({
        ...fallbackPlan,
        isFallback: true,
        analysis: {
          model: 'heuristic-local-redesign',
          promptVersion: PLAN_LAYOUT_PROMPT_VERSION,
          analyzedAt: new Date().toISOString(),
        },
      });
      return;
    }

    // Call Gemini Vision API
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');

    const ocrSummary = Array.isArray(ocrLines)
      ? ocrLines.map((l: { id: string; text: string; box: unknown }) => `[${l.id}] "${l.text}" (box: ${JSON.stringify(l.box)})`).join('\n')
      : '';

    const promptText = `
Given this certificate image and its OCR extracted lines:
${ocrSummary}

User instruction / refinement hint:
${userPrompt || 'Standard professional redesign: preserve crests/logos/titles/signatures, remove sample text lines, and place a composite certification sentence with recipient, event title, and dates.'}

Plan the layout redesign now. Output pure JSON matching the schema.
`;

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: PLAN_LAYOUT_SYSTEM_INSTRUCTION },
            { text: promptText },
            {
              inline_data: {
                mime_type: mimeType,
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1,
      },
    };

    const aiRes = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.warn('[planLayout] Gemini API error:', errText);
      const fallbackPlan = generateFallbackLayoutPlan(ocrLines);
      res.status(200).json({
        ...fallbackPlan,
        isFallback: true,
        analysis: {
          model: 'heuristic-fallback',
          promptVersion: PLAN_LAYOUT_PROMPT_VERSION,
          analyzedAt: new Date().toISOString(),
        },
      });
      return;
    }

    const aiData = await aiRes.json();
    const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      parsedJson = match ? JSON.parse(match[0]) : {};
    }

    const validated = LayoutPlanResponseSchema.safeParse(parsedJson);

    if (!validated.success) {
      console.warn('[planLayout] Schema validation failed, using fallback plan:', validated.error);
      const fallbackPlan = generateFallbackLayoutPlan(ocrLines);
      res.status(200).json({
        ...fallbackPlan,
        isFallback: true,
        analysis: {
          model: 'heuristic-fallback',
          promptVersion: PLAN_LAYOUT_PROMPT_VERSION,
          analyzedAt: new Date().toISOString(),
        },
      });
      return;
    }

    const { linesToRemove, linesToKeep, safeZones, newBlocks, reasoning } = validated.data;

    // Normalize coordinates and sanitize fields
    const normalizedSafeZones = safeZones.map(parseToNormalizedBox).filter(Boolean);
    const normalizedBlocks = newBlocks.map((b) => ({
      ...b,
      box: parseToNormalizedBox(b.box),
      source: 'redesign' as const,
    }));

    res.status(200).json({
      linesToRemove,
      linesToKeep,
      safeZones: normalizedSafeZones,
      newBlocks: normalizedBlocks,
      reasoning: reasoning || 'AI layout redesigned successfully.',
      isFallback: false,
      analysis: {
        model,
        promptVersion: PLAN_LAYOUT_PROMPT_VERSION,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    console.error('[planLayout] Unexpected error:', err);
    res.status(500).json({
      error: 'Failed to plan layout redesign.',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Heuristic Layout Synthesizer
 * Identifies boilerplate sentences, creates composite text blocks and marks placeholder lines.
 */
function generateFallbackLayoutPlan(ocrLines: Array<{ id: string; text: string; box?: unknown }>) {
  const linesToRemove: string[] = [];
  const linesToKeep: string[] = [];

  for (const l of ocrLines) {
    const textLower = (l.text || '').toLowerCase();
    if (
      textLower.includes('this is to certify') ||
      textLower.includes('participated') ||
      textLower.includes('held from') ||
      textLower.includes('completed') ||
      textLower.includes('awarded to') ||
      textLower.includes('cert-') ||
      textLower.includes('alice') ||
      textLower.includes('john doe')
    ) {
      linesToRemove.push(l.id);
    } else {
      linesToKeep.push(l.id);
    }
  }

  return {
    linesToRemove,
    linesToKeep,
    safeZones: [{ x: 0.1, y: 0.25, w: 0.8, h: 0.55 }],
    newBlocks: [
      {
        key: 'certificateNumber',
        label: 'Certificate Number',
        type: 'number',
        required: true,
        box: { x: 0.15, y: 0.16, w: 0.35, h: 0.04 },
        style: {
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: 600,
          color: '#1E293B',
          align: 'left',
          letterSpacing: 0,
          lineHeight: 1.2,
          minFontSize: 10,
          maxLines: 1,
          uppercase: false,
        },
        sampleText: 'CERT-A-1001',
        confidence: 0.95,
        source: 'redesign',
      },
      {
        key: 'mainBody',
        label: 'Certification Statement',
        type: 'compositeText',
        required: true,
        box: { x: 0.1, y: 0.42, w: 0.8, h: 0.2 },
        compositeTemplate:
          'This is to certify that {{recipientName}} participated in the {{eventTitle}} held from {{startDate}} to {{endDate}}.',
        tokens: [
          { key: 'recipientName', label: 'Recipient Name', type: 'name', sampleValue: 'Alice Nakamoto' },
          { key: 'eventTitle', label: 'Event Title', type: 'text', sampleValue: 'Zero Knowledge Cryptography Deep Dive' },
          { key: 'startDate', label: 'Start Date', type: 'date', sampleValue: 'August 01, 2026' },
          { key: 'endDate', label: 'End Date', type: 'date', sampleValue: 'August 05, 2026' },
        ],
        style: {
          fontFamily: 'Plus Jakarta Sans',
          fontSize: 22,
          fontWeight: 400,
          color: '#334155',
          align: 'center',
          letterSpacing: 0,
          lineHeight: 1.6,
          minFontSize: 14,
          maxLines: 4,
          uppercase: false,
        },
        sampleText:
          'This is to certify that Alice Nakamoto participated in the Zero Knowledge Cryptography Deep Dive held from August 01, 2026 to August 05, 2026.',
        confidence: 0.98,
        source: 'redesign',
      },
    ],
    reasoning:
      'Extracted boilerplate certification statement into unified compositeText block with recipientName, eventTitle, startDate, and endDate tokens.',
  };
}
