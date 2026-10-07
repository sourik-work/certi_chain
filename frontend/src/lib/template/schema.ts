/**
 * @file schema.ts
 * @summary Single Responsibility: Strict security validation for TemplateSpec JSON.
 *
 * Enforces strict boundaries, whitelisted fonts, safe image MIME types, hex colors, and field key formats.
 */

import { TemplateSpec, TemplateBlock, TemplateField, Rect, TextStyle } from './types';
import { WHITELISTED_FONTS } from './fonts';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{0,39}$/;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/webp', 'image/png'];

export interface SchemaValidationResult {
  valid: boolean;
  isValid: boolean;
  errors: string[];
}

export function validateRect(rect: unknown, canvas: { width: number; height: number }, prefix = 'Rect'): string[] {
  const errors: string[] = [];
  if (!rect || typeof rect !== 'object') {
    return [`${prefix} must be an object.`];
  }
  const r = rect as Partial<Rect>;

  if (typeof r.x !== 'number' || isNaN(r.x) || r.x < 0) errors.push(`${prefix}.x must be >= 0`);
  if (typeof r.y !== 'number' || isNaN(r.y) || r.y < 0) errors.push(`${prefix}.y must be >= 0`);
  if (typeof r.w !== 'number' || isNaN(r.w) || r.w <= 0) errors.push(`${prefix}.w must be > 0`);
  if (typeof r.h !== 'number' || isNaN(r.h) || r.h <= 0) errors.push(`${prefix}.h must be > 0`);

  if (r.x !== undefined && r.w !== undefined && r.x + r.w > canvas.width) {
    errors.push(`${prefix} exceeds canvas boundaries (x + w = ${r.x + r.w} > ${canvas.width})`);
  }
  if (r.y !== undefined && r.h !== undefined && r.y + r.h > canvas.height) {
    errors.push(`${prefix} exceeds canvas boundaries (y + h = ${r.y + r.h} > ${canvas.height})`);
  }

  return errors;
}

export function validateTextStyle(style: unknown, prefix = 'TextStyle'): string[] {
  const errors: string[] = [];
  if (!style || typeof style !== 'object') {
    return [`${prefix} must be an object.`];
  }
  const s = style as Partial<TextStyle>;

  const validFonts = WHITELISTED_FONTS.map((f) => f.family.toLowerCase());
  if (!s.fontFamily || !validFonts.includes(s.fontFamily.toLowerCase())) {
    errors.push(`${prefix}.fontFamily "${s.fontFamily}" is not in the font whitelist.`);
  }

  if (typeof s.fontSize !== 'number' || isNaN(s.fontSize) || s.fontSize < 4 || s.fontSize > 300) {
    errors.push(`${prefix}.fontSize must be between 4 and 300.`);
  }

  if (!s.color || !HEX_COLOR_REGEX.test(s.color)) {
    errors.push(`${prefix}.color "${s.color}" must match #RRGGBB format.`);
  }

  const validAlignments = ['left', 'center', 'right', 'justify'];
  if (!s.align || !validAlignments.includes(s.align)) {
    errors.push(`${prefix}.align must be one of: ${validAlignments.join(', ')}.`);
  }

  if (typeof s.lineHeight !== 'number' || isNaN(s.lineHeight) || s.lineHeight < 0.5 || s.lineHeight > 5) {
    errors.push(`${prefix}.lineHeight must be between 0.5 and 5.`);
  }

  return errors;
}

export function validateTemplateSpec(spec: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!spec || typeof spec !== 'object') {
    return { valid: false, isValid: false, errors: ['TemplateSpec must be a non-null object.'] };
  }

  const s = spec as Partial<TemplateSpec>;

  if (s.schema !== 'certichain.template/v1') {
    errors.push('Invalid or unsupported schema version (must be "certichain.template/v1").');
  }

  if (!s.id || typeof s.id !== 'string') {
    errors.push('Template ID is required.');
  }

  if (!s.name || typeof s.name !== 'string' || s.name.trim().length === 0) {
    errors.push('Template name is required.');
  }

  if (!s.canvas || typeof s.canvas.width !== 'number' || typeof s.canvas.height !== 'number') {
    errors.push('Canvas dimensions (width and height) are required.');
  } else {
    if (s.canvas.width < 300 || s.canvas.width > 4000) errors.push('Canvas width must be between 300 and 4000.');
    if (s.canvas.height < 300 || s.canvas.height > 4000) errors.push('Canvas height must be between 300 and 4000.');
  }

  const canvas = s.canvas || { width: 1920, height: 1080 };

  // Background validation
  if (!s.background || typeof s.background !== 'object') {
    errors.push('Template background is required.');
  } else {
    if (!ALLOWED_MIME_TYPES.includes(s.background.mime)) {
      errors.push(`Disallowed background MIME type "${s.background.mime}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}.`);
    }

    if (!s.background.dataUrl || typeof s.background.dataUrl !== 'string') {
      errors.push('Background dataUrl is required.');
    } else {
      if (s.background.dataUrl.includes('<script') || s.background.dataUrl.includes('image/svg')) {
        errors.push('Security violation: SVG and scripted data URLs are prohibited.');
      }
      if (!s.background.dataUrl.startsWith('data:image/')) {
        errors.push('Background dataUrl must be a valid image data URI.');
      }
    }
  }

  // Blocks validation
  if (!Array.isArray(s.blocks)) {
    errors.push('Template blocks must be an array.');
  } else {
    if (s.blocks.length > 40) {
      errors.push(`Maximum 40 blocks allowed (found ${s.blocks.length}).`);
    }

    s.blocks.forEach((block: TemplateBlock, idx: number) => {
      if (!block.id) errors.push(`Block[${idx}] missing id.`);
      errors.push(...validateRect(block.rect, canvas, `Block[${idx}].rect`));
      if (!block.eraseOnly) {
        errors.push(...validateTextStyle(block.style, `Block[${idx}].style`));
      }
    });
  }

  // Fields validation
  if (!Array.isArray(s.fields)) {
    errors.push('Template fields must be an array.');
  } else {
    const validFieldTypes = ['text', 'textarea', 'date', 'number', 'select'];
    s.fields.forEach((field: TemplateField, idx: number) => {
      if (!field.key || !FIELD_KEY_REGEX.test(field.key)) {
        errors.push(`Invalid field key "${field.key}": must match /^[a-z][a-z0-9_]{0,39}$/`);
      }
      if (!field.label || typeof field.label !== 'string') {
        errors.push(`Field[${idx}] missing label.`);
      }
      if (!validFieldTypes.includes(field.type)) {
        errors.push(`Field[${idx}].type "${field.type}" must be one of: ${validFieldTypes.join(', ')}`);
      }
    });
  }

  // QR placement validation
  if (s.qr) {
    errors.push(...validateRect(s.qr.rect, canvas, 'QR.rect'));
  }

  const valid = errors.length === 0;
  return {
    valid,
    isValid: valid,
    errors,
  };
}
