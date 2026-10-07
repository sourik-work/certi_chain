/**
 * @file tokens.ts
 * @summary Single Responsibility: Parses and substitutes template string tokens {{key}} and {{key|format}}.
 */

import { formatDate } from './dates';
import { TextStyle } from './types';

export interface ParsedToken {
  raw: string; // e.g. "{{recipient_name}}" or "{{start_date|MMMM DDo}}"
  key: string; // e.g. "recipient_name"
  format?: string; // e.g. "MMMM DDo"
  startIndex?: number;
  endIndex?: number;
}

export type TextSegment =
  | { type: 'text'; content: string }
  | { type: 'token'; key: string; format?: string; value: string; raw: string };

export interface RichSegment {
  text: string;
  isToken: boolean;
  key?: string;
  style?: Partial<TextStyle>;
}

const TOKEN_REGEX = /\{\{([a-zA-Z0-9_]+)(?:\|([^}]+))?\}\}/g;

/**
 * Extracts all token definitions from a template string.
 */
export function extractTokens(templateStr: string): ParsedToken[] {
  const tokens: ParsedToken[] = [];
  if (!templateStr) return tokens;

  let match: RegExpExecArray | null;
  const regex = new RegExp(TOKEN_REGEX);

  while ((match = regex.exec(templateStr)) !== null) {
    tokens.push({
      raw: match[0],
      key: match[1],
      format: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return tokens;
}

export const parseTokens = extractTokens;

/**
 * Formats a specific token value based on its optional formatting pipeline.
 */
export function formatTokenValue(value: unknown, format?: string): string {
  if (value === undefined || value === null) return '';
  const strVal = String(value);

  if (!format) return strVal;

  const trimmedFormat = format.trim();

  // If format matches date tokens (e.g. "MMMM Do", "YYYY-MM-DD", "MMMM DDo")
  if (/[YMDd]/.test(trimmedFormat)) {
    return formatDate(strVal, trimmedFormat);
  }

  // Text transform filters
  if (trimmedFormat.toLowerCase() === 'uppercase') {
    return strVal.toUpperCase();
  }
  if (trimmedFormat.toLowerCase() === 'lowercase') {
    return strVal.toLowerCase();
  }
  if (trimmedFormat.toLowerCase() === 'capitalize') {
    return strVal.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return strVal;
}

/**
 * Replaces all tokens in a template string with resolved and formatted values.
 * Unknown keys without an entry in values are preserved as raw tokens.
 */
export function substituteTokens(
  templateStr: string,
  values: Record<string, string | number | undefined | null>
): string {
  if (!templateStr) return '';

  return templateStr.replace(TOKEN_REGEX, (fullMatch, key: string, format?: string) => {
    if (!(key in values)) {
      return fullMatch;
    }
    const val = values[key];
    if (val === undefined || val === null) {
      return '';
    }
    return formatTokenValue(val, format);
  });
}

export interface RichSegment {
  text: string;
  isToken: boolean;
  key?: string;
  isMissing?: boolean;
  style?: Partial<TextStyle>;
}

/**
 * Splits a template string into rich segments with individual token style overrides.
 */
export function renderRichSegments(
  templateStr: string,
  values: Record<string, string | number | undefined | null>,
  tokenStyles?: Record<string, Partial<TextStyle>>,
  mode: 'editor' | 'issued' = 'issued'
): RichSegment[] {
  if (!templateStr) return [];

  const segments: RichSegment[] = [];
  let lastIndex = 0;
  const regex = new RegExp(TOKEN_REGEX);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(templateStr)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: templateStr.slice(lastIndex, match.index),
        isToken: false,
      });
    }

    const key = match[1];
    const format = match[2];
    const hasVal = key in values && values[key] !== undefined && values[key] !== null && String(values[key]).trim() !== '';
    let text: string;
    let isMissing = false;

    if (hasVal) {
      text = formatTokenValue(values[key], format);
    } else if (mode === 'issued') {
      isMissing = true;
      text = `[MISSING: ${key}]`;
    } else {
      text = match[0];
    }

    segments.push({
      text,
      isToken: true,
      key,
      ...(isMissing ? { isMissing: true } : {}),
      style: tokenStyles ? tokenStyles[key] : undefined,
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < templateStr.length) {
    segments.push({
      text: templateStr.slice(lastIndex),
      isToken: false,
    });
  }

  return segments;
}

/**
 * Splits a template string into sequential plain text segments and token segments.
 */
export function parseTextSegments(
  templateStr: string,
  values: Record<string, string | number | undefined | null>
): TextSegment[] {
  if (!templateStr) return [];

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  const regex = new RegExp(TOKEN_REGEX);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(templateStr)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: templateStr.slice(lastIndex, match.index),
      });
    }

    const key = match[1];
    const format = match[2];
    const rawVal = values[key] ?? '';
    const formattedVal = formatTokenValue(rawVal, format);

    segments.push({
      type: 'token',
      key,
      format,
      value: formattedVal,
      raw: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < templateStr.length) {
    segments.push({
      type: 'text',
      content: templateStr.slice(lastIndex),
    });
  }

  return segments;
}
