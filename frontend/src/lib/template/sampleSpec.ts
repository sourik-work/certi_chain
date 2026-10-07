/**
 * @file sampleSpec.ts
 * @summary Hard-coded high-fidelity reference template specification matching the worked example sample certificate.
 */

import { TemplateSpec } from './types';

export const SAMPLE_TEMPLATE_SPEC: TemplateSpec = {
  schema: 'certichain.template/v1',
  id: 'tpl_sample_cbt_primer',
  name: 'Blockchain Training Certificate',
  createdAt: '2026-07-10T00:00:00.000Z',
  canvas: {
    width: 1920,
    height: 1080,
  },
  background: {
    mime: 'image/jpeg',
    // Minimal fallback SVG-free base64 or placeholder canvas background
    dataUrl:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    erasedBackground: true,
  },
  blocks: [
    {
      id: 'blk_cert_no',
      rect: { x: 120, y: 310, w: 600, h: 40 },
      text: 'Certificate No: {{certificate_number}}',
      style: {
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 600,
        fontSize: 16,
        color: '#1E293B',
        align: 'left',
        lineHeight: 1.2,
        letterSpacing: 0.5,
        transform: 'none',
        fit: 'shrink',
        maxLines: 1,
      },
    },
    {
      id: 'blk_cert_type',
      rect: { x: 600, y: 380, w: 720, h: 60 },
      text: 'OF {{certificate_type}}',
      style: {
        fontFamily: 'Outfit',
        fontWeight: 700,
        fontSize: 32,
        color: '#D97706',
        align: 'center',
        lineHeight: 1.2,
        letterSpacing: 4,
        transform: 'uppercase',
        fit: 'shrink',
        maxLines: 1,
      },
    },
    {
      id: 'blk_main_body',
      rect: { x: 360, y: 470, w: 1200, h: 220 },
      text: 'This is to certify that {{recipient_name}} {{role_verb}} in the {{event_name}} held from {{start_date|MMMM DDo}} to {{end_date|MMMM DDo, YYYY}}.',
      style: {
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 400,
        fontSize: 22,
        color: '#334155',
        align: 'center',
        lineHeight: 1.8,
        letterSpacing: 0.2,
        transform: 'none',
        fit: 'shrink',
        maxLines: 4,
      },
      tokenStyles: {
        recipient_name: {
          fontWeight: 700,
          color: '#065F46',
          transform: 'uppercase',
        },
        event_name: {
          fontWeight: 600,
          color: '#0F172A',
        },
      },
    },
  ],
  fields: [
    {
      key: 'certificate_number',
      label: 'Certificate Number',
      type: 'text',
      required: true,
      sample: 'SASET/CBT/EVENT01/0607-1007-26/VOL11',
      mapsTo: 'certificate_number',
    },
    {
      key: 'certificate_type',
      label: 'Certificate Type',
      type: 'select',
      required: true,
      sample: 'PARTICIPATION',
      options: ['PARTICIPATION', 'COMPLETION', 'APPRECIATION', 'EXCELLENCE'],
      mapsTo: 'credential_title',
    },
    {
      key: 'recipient_name',
      label: 'Recipient Full Name',
      type: 'text',
      required: true,
      sample: 'MR. SOUMALYA MUKHERJEE',
      mapsTo: 'recipient_name',
    },
    {
      key: 'role_verb',
      label: 'Role Verb',
      type: 'text',
      required: true,
      sample: 'volunteered',
    },
    {
      key: 'event_name',
      label: 'Course / Event Name',
      type: 'textarea',
      required: true,
      sample: 'Centre for Blockchain Technology - 05 Days Blockchain Technology Primer (5 Days - Training) Course',
      mapsTo: 'description',
    },
    {
      key: 'start_date',
      label: 'Start Date',
      type: 'date',
      required: true,
      sample: '2026-07-06',
      mapsTo: 'issue_date',
    },
    {
      key: 'end_date',
      label: 'End Date',
      type: 'date',
      required: true,
      sample: '2026-07-10',
    },
  ],
  qr: {
    rect: { x: 880, y: 760, w: 160, h: 160 },
    caption: 'Scan to verify',
    tile: true,
  },
  verifyStrip: {
    rect: { x: 360, y: 940, w: 1200, h: 30 },
    style: {
      fontFamily: 'Inter',
      fontWeight: 500,
      fontSize: 12,
      color: '#64748B',
      align: 'center',
      lineHeight: 1.2,
      letterSpacing: 0.5,
      transform: 'none',
      fit: 'none',
      maxLines: 1,
    },
  },
};
