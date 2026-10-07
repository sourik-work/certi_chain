# Implementation Plan — AI Layout Redesign Mode

## 1. Objectives & Overview
Add an **AI Layout Redesign** mode to the Custom Certificate workflow.
The system preserves the visual branding of an uploaded certificate (borders, university/organization crests, logos, signatures, and decorative titles) while erasing placeholder text lines and placing clean, auto-fitting variable fields and `compositeText` sentences into calculated safe zones.

## 2. Phases & Files to Touch

### Phase 1: Data Model & Types Extension
- `frontend/src/types/customTemplate.ts`:
  - Add `'compositeText'` to `FieldType`.
  - Add `compositeTemplate?: string` (e.g. `"This is to certify that {{recipientName}} participated in {{eventTitle}} held from {{startDate}} to {{endDate}}."`).
  - Add `tokens?: Array<{ key: string; label: string; type: FieldType; style?: Partial<FieldStyle> }>`.
  - Add `baseCid?: string`, `baseHash?: string`, `cleanedBaseDataUrl?: string` to `CertificateTemplate`.
- `frontend/src/types/certificate.ts`:
  - Extend `CustomMetadataRef` with `baseCid?: string`, `baseHash?: string`.
- `frontend/src/lib/validateMetadata.ts`:
  - Allow `compositeText`, token schemas, `baseCid`, and `baseHash`.
- `frontend/src/lib/layoutHash.ts`:
  - Include `compositeTemplate` and `tokens` in canonical layout hashing.

### Phase 2: Coordinate Normalizer & OCR Pass
- `frontend/src/lib/coordinateNormalizer.ts`:
  - Convert `[ymin, xmin, ymax, xmax]` in 0..1000 (Gemini format) to normalized `{ x, y, w, h }` in 0..1.
  - Comprehensive unit test `coordinateNormalizer.test.ts`.
- `frontend/src/lib/ocrService.ts`:
  - Lazy-load OCR line extraction using `tesseract.js` or preprocessed bounding boxes.

### Phase 3: Serverless `planLayout.ts` & Prompt Contract
- `frontend/api/prompts/planLayout.v1.ts`:
  - Prompt instructing Gemini Vision to analyze OCR lines, identify placeholder lines to remove vs static lines to keep, detect safe zones, and output `newBlocks` (including `compositeText`).
  - Anti-prompt injection: treats visual text as untrusted data.
- `frontend/api/planLayout.ts`:
  - Session verification, rate limiting, Zod validation, and coordinate transformation.

### Phase 4: Base Cleaning & Erasing Engine
- `frontend/src/lib/cleanBase.ts`:
  - Canvas-based background color & gradient estimation for erasing text bounding boxes.
  - Generates cleaned base image data URL, blob, and `baseHash`.
  - Creates non-destructive template revisions.

### Phase 5: Deterministic Layout Validator
- `frontend/src/lib/layoutValidator.ts`:
  - Overlap detection (IoU < 0.2).
  - Bounds & margin checks (within 0.02 - 0.98).
  - Long Unicode name fit stress testing (40+ characters).
  - Retry logic for AI layout repair.

### Phase 6: Rendering Engine & Dynamic Form
- `frontend/src/lib/renderCertificate.ts`:
  - Support `compositeText` token replacement, word wrapping, bold token highlights, and auto-shrink-to-fit.
- `frontend/src/components/custom/DynamicForm.tsx`:
  - Token input extraction so all `{{token}}` variables render as form inputs.
- `frontend/src/components/custom/BeforeAfterSlider.tsx`:
  - Interactive split slider showing original uploaded design vs cleaned base with redesigned layout.
- `frontend/src/pages/IssuerDashboard.tsx`:
  - "Redesign layout with AI" button, refinement prompt box, style switcher, and fallback notice.

### Phase 7: Anchoring, Verification & Hashing
- `frontend/src/lib/verify.ts`:
  - Validate `baseHash` against `metadata.custom.baseHash`.
- `docs/HASHING.md` & `docs/PROGRESS.md`:
  - Update specifications and requirements.

### Phase 8: Fixture Testing with Centre for Blockchain Technology
- `frontend/src/test/aiLayoutRedesign.test.ts`:
  - Real fixture `real-sample-certificate.jpg` extraction, line removal, token binding, and rendering.
