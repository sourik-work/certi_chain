/**
 * Custom Certificate Template Types
 * Defines data structures for uploaded templates, AI field detection,
 * layout definitions, bounding boxes, and design editor integrations.
 */

export type FieldType =
  | 'text'
  | 'longText'
  | 'name'
  | 'date'
  | 'number'
  | 'email'
  | 'walletAddress'
  | 'select'
  | 'signature'
  | 'logo'
  | 'qrCode'
  | 'certId'
  | 'proofHash'
  | 'compositeText';

export interface NormalizedBox {
  /** X coordinate normalized to template width (0..1) */
  x: number;
  /** Y coordinate normalized to template height (0..1) */
  y: number;
  /** Width normalized to template width (0..1) */
  w: number;
  /** Height normalized to template height (0..1) */
  h: number;
}

export interface FieldStyle {
  fontFamily: string;
  fontSize: number; // in pt or px relative to reference canvas
  fontWeight: number; // 100..900
  color: string; // #RRGGBB hex
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  minFontSize: number;
  maxLines: number;
  uppercase: boolean;
}

export interface TemplateToken {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  sampleValue?: string;
  style?: Partial<FieldStyle>;
}

export interface TemplateField {
  /** Unique camelCase identifier (e.g. "recipientName", "issueDate") */
  key: string;
  /** Human-readable field label */
  label: string;
  /** Data type for input rendering and validation */
  type: FieldType;
  /** Whether field value is strictly required for issuance */
  required: boolean;
  /** Bounding box coordinates on template (null = hidden metadata field) */
  box: NormalizedBox | null;
  /** Typography & visual styling (null for non-rendered metadata fields) */
  style: FieldStyle | null;
  /** Sample text detected in original design */
  sampleText?: string;
  /** Confidence score from AI analysis (0..1, 1 for issuer-created) */
  confidence: number;
  /** Source of this field definition */
  source: 'ai' | 'issuer' | 'redesign';
  /** Options list for 'select' field type */
  options?: string[];
  /** Composite template string using {{token}} syntax for 'compositeText' type */
  compositeTemplate?: string;
  /** Token definitions embedded in compositeTemplate */
  tokens?: TemplateToken[];
  /** Optional regex pattern or min/max constraints */
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    maxLength?: number;
  };
}

export interface StaticTextRegion {
  box: NormalizedBox;
  text: string;
}

export interface CertificateTemplate {
  schemaVersion: 1;
  /** SHA-256 of original uploaded file bytes (0x-prefixed 64 hex chars) */
  templateHash: string;
  /** IPFS CID of the original pinned template asset */
  templateCid?: string;
  /** SHA-256 of cleaned background base image bytes if redesigned */
  baseHash?: string;
  /** IPFS CID of cleaned background base image */
  baseCid?: string;
  /** Data URL for cleaned base image without placeholder text */
  cleanedBaseDataUrl?: string;
  /** MIME type of the uploaded template */
  mimeType: string;
  /** Original template width in pixels */
  widthPx: number;
  /** Original template height in pixels */
  heightPx: number;
  /** Detected or calculated orientation */
  orientation: 'landscape' | 'portrait';
  /** Detected and confirmed variable fields */
  fields: TemplateField[];
  /** Static text regions identified in the template (logos, borders, headers) */
  staticTextRegions?: StaticTextRegion[];
  /** Safe bounding zones calculated for text placement */
  safeZones?: NormalizedBox[];
  /** Analysis metadata */
  analysis: {
    model: string;
    promptVersion: string;
    analyzedAt: string;
  };
  /** Local data URL for instant client-side preview */
  previewDataUrl?: string;
}

export interface TemplateRevision {
  id: string;
  title: string;
  timestamp: string;
  source: 'upload' | 'ai_analysis' | 'ai_redesign' | 'manual_edit' | 'canva' | 'figma' | 'quick_edit';
  template: CertificateTemplate;
}

export interface CustomCertificateValues {
  [fieldKey: string]: string;
}
