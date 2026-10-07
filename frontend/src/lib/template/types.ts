/**
 * @file types.ts
 * @summary Data model and type definitions for CertiChain Custom Certificate Templates.
 */

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
}; // Pixels in canvas coordinates (natural size of the stored background)

export type TextStyle = {
  fontFamily: string; // from whitelist
  fontWeight: 300 | 400 | 500 | 600 | 700 | 800;
  fontSize: number; // px at canvas scale
  color: string; // #RRGGBB
  align: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number; // multiplier e.g. 1.2, 1.4
  letterSpacing: number; // px
  transform: 'none' | 'uppercase' | 'capitalize';
  fit: 'none' | 'shrink'; // shrink-to-fit inside rect (min 60% of fontSize)
  maxLines: number;
};

export type TemplateBlock = {
  id: string;
  rect: Rect; // area that is erased from the background and re-drawn
  text: string; // template string with tokens {{key}} or {{key|format}}
  style: TextStyle;
  tokenStyles?: Record<string, Partial<TextStyle>>; // e.g. recipient_name -> bold + accent colour inside a paragraph
  eraseOnly?: boolean; // erase region without drawing text
  role?: 'fixed' | 'variable' | 'paragraph' | 'erase_only';
  sourceRect?: Rect;
  sourceText?: string;
};

export type FieldMapTarget =
  | 'recipient_name'
  | 'credential_title'
  | 'description'
  | 'issue_date'
  | 'expiry_date'
  | 'issuer_name'
  | 'certificate_number'
  | 'recipient_id'
  | 'custom';

export type TemplateField = {
  key: string; // matches tokens (e.g. "recipient_name")
  label: string; // shown in the form
  type: 'text' | 'textarea' | 'date' | 'number' | 'select';
  required: boolean;
  sample: string; // original value found in the sample (used as placeholder / default)
  options?: string[]; // for select, e.g. ["participation", "completion", "appreciation", "achievement"]
  maxLength?: number;
  mapsTo?: FieldMapTarget;
};

export type QrPlacement = {
  rect: Rect;
  caption: string;
  tile: boolean; // tile = white rounded backing for scan reliability
};

export type TemplateSpec = {
  schema: 'certichain.template/v1';
  id: string;
  name: string;
  createdAt: string;
  canvas: {
    width: number;
    height: number;
  };
  background: {
    mime: 'image/jpeg' | 'image/webp' | 'image/png';
    dataUrl: string;
    erasedBackground: boolean;
  };
  blocks: TemplateBlock[];
  fields: TemplateField[];
  qr: QrPlacement;
  verifyStrip?: {
    rect: Rect;
    style: TextStyle;
  };
  figma?: {
    fileKey: string;
    nodeId?: string;
    connectedAt?: string;
  };
};

export interface AnalysisCandidateBlock {
  bbox: [number, number, number, number]; // [x0, y0, x1, y1] normalized 0..1
  text: string;
  fontFamily?: string;
  fontWeight?: number;
  fontSizeFraction?: number;
  colorHex?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  role: 'fixed' | 'variable';
  fields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'date' | 'number' | 'textarea' | 'select';
    sample: string;
    options?: string[];
    mapsTo?: FieldMapTarget;
  }>;
}

export interface AnalysisResult {
  engine: 'vision' | 'ocr' | 'manual';
  canvas: { width: number; height: number };
  blocks: TemplateBlock[];
  fields: TemplateField[];
  suggestedName: string;
}

export interface TemplateStorageItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  thumbnailDataUrl: string;
  spec: TemplateSpec;
}
