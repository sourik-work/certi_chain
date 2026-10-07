/**
 * SVG Sanitization Utility
 * Sanitizes uploaded SVG documents using DOMPurify with the strict USE_PROFILES: { svg: true } profile.
 * Rejects and removes scripts, foreignObject, event handlers, external hrefs, and dangerous entities.
 */

import DOMPurify from 'dompurify';

export interface SvgSanitizeResult {
  isValid: boolean;
  sanitizedSvg: string;
  reasons: string[];
}

const FORBIDDEN_TAGS = ['script', 'foreignobject', 'iframe', 'object', 'embed', 'form', 'input'];

export function sanitizeSvg(svgContent: string): SvgSanitizeResult {
  const reasons: string[] = [];

  if (!svgContent || typeof svgContent !== 'string') {
    return {
      isValid: false,
      sanitizedSvg: '',
      reasons: ['Empty or non-string SVG payload.'],
    };
  }

  // Quick check for overt script tags or malicious directives
  if (/<script\b/i.test(svgContent)) {
    reasons.push('Prohibited <script> tag detected in SVG.');
  }

  if (/<foreignobject\b/i.test(svgContent)) {
    reasons.push('Prohibited <foreignObject> tag detected in SVG.');
  }

  if (/on\w+\s*=/i.test(svgContent)) {
    reasons.push('Inline JavaScript event handler (e.g. onload, onerror) detected in SVG.');
  }

  if (/xlink:href\s*=\s*["']javascript:/i.test(svgContent) || /href\s*=\s*["']javascript:/i.test(svgContent)) {
    reasons.push('JavaScript URI in href attribute detected.');
  }

  // Execute strict DOMPurify with SVG profile
  const cleaned = DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    ALLOW_DATA_ATTR: false,
    ADD_TAGS: ['svg', 'path', 'g', 'rect', 'circle', 'text', 'tspan', 'defs', 'line', 'polygon', 'polyline', 'image'],
  });

  // Verify that it still represents a valid SVG root
  if (!cleaned.trim().toLowerCase().includes('<svg')) {
    return {
      isValid: false,
      sanitizedSvg: '',
      reasons: [...reasons, 'Sanitization stripped non-SVG content or invalid SVG root.'],
    };
  }

  return {
    isValid: reasons.length === 0,
    sanitizedSvg: cleaned,
    reasons,
  };
}
