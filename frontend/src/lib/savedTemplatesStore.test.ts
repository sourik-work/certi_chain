import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSavedCustomTemplates,
  saveSavedCustomTemplate,
  deleteSavedCustomTemplate,
  renameSavedCustomTemplate,
} from './savedTemplatesStore';
import type { CertificateTemplate } from '../types/customTemplate';

describe('savedTemplatesStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockTemplate: CertificateTemplate = {
    schemaVersion: 1,
    templateHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    mimeType: 'image/png',
    widthPx: 1920,
    heightPx: 1080,
    orientation: 'landscape',
    fields: [
      {
        key: 'recipientName',
        label: 'Recipient Name',
        type: 'name',
        required: true,
        box: { x: 0.2, y: 0.4, w: 0.6, h: 0.1 },
        style: null,
        confidence: 1.0,
        source: 'issuer',
      },
      {
        key: 'qrCode',
        label: 'Verification QR',
        type: 'qrCode',
        required: true,
        box: { x: 0.8, y: 0.8, w: 0.15, h: 0.15 },
        style: null,
        confidence: 1.0,
        source: 'issuer',
      },
    ],
    analysis: {
      model: 'test',
      promptVersion: '1.0',
      analyzedAt: new Date().toISOString(),
    },
  };

  it('starts with an empty template list', () => {
    expect(getSavedCustomTemplates()).toEqual([]);
  });

  it('saves a template and retrieves it correctly', () => {
    const saved = saveSavedCustomTemplate(mockTemplate, 'Honorary Degree in AI', {
      recipientName: 'Alice Nakamoto',
    });

    expect(saved.title).toBe('Honorary Degree in AI');
    expect(saved.issueCount).toBe(1);

    const list = getSavedCustomTemplates();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Honorary Degree in AI');
    expect(list[0].template.templateHash).toBe(mockTemplate.templateHash);
  });

  it('increments issue count when saving the same template again', () => {
    saveSavedCustomTemplate(mockTemplate, 'First Title');
    const updated = saveSavedCustomTemplate(mockTemplate, 'Updated Title');

    expect(updated.issueCount).toBe(2);
    const list = getSavedCustomTemplates();
    expect(list).toHaveLength(1);
    expect(list[0].issueCount).toBe(2);
    expect(list[0].title).toBe('Updated Title');
  });

  it('renames a saved template', () => {
    saveSavedCustomTemplate(mockTemplate, 'Old Name');
    renameSavedCustomTemplate(mockTemplate.templateHash, 'New Certificate Name');

    const list = getSavedCustomTemplates();
    expect(list[0].title).toBe('New Certificate Name');
  });

  it('deletes a saved template', () => {
    saveSavedCustomTemplate(mockTemplate, 'Test Template');
    expect(getSavedCustomTemplates()).toHaveLength(1);

    deleteSavedCustomTemplate(mockTemplate.templateHash);
    expect(getSavedCustomTemplates()).toHaveLength(0);
  });
});
