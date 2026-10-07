import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemplateRenderer } from './TemplateRenderer';
import { SAMPLE_TEMPLATE_SPEC } from '../../lib/template/sampleSpec';

describe('TemplateRenderer component', () => {
  it('substitutes template tokens and renders rich styled segments', () => {
    const values = {
      certificate_number: 'SASET/CBT/TEST/001',
      certificate_type: 'PARTICIPATION',
      recipient_name: 'MR. SOUMALYA MUKHERJEE',
      role_verb: 'volunteered',
      event_name: '5 Days Blockchain Primer Course',
      start_date: '2026-07-06',
      end_date: '2026-07-10',
    };

    render(
      <TemplateRenderer
        spec={SAMPLE_TEMPLATE_SPEC}
        values={values}
        certId="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        issuerAddress="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
      />
    );

    // Verify token substituted strings are present in the rendered document
    expect(screen.getByText('SASET/CBT/TEST/001')).toBeDefined();
    expect(screen.getByText('PARTICIPATION')).toBeDefined();
    expect(screen.getByText('MR. SOUMALYA MUKHERJEE')).toBeDefined();
    expect(screen.getByText(/5 Days Blockchain Primer Course/)).toBeDefined();
    expect(screen.getByText('Scan to verify')).toBeDefined();
  });

  it('updates rendered certificate dynamically when field values change', () => {
    const initialValues = {
      recipient_name: 'MR. SOUMALYA MUKHERJEE',
      role_verb: 'volunteered',
      event_name: 'Original Blockchain Primer',
      start_date: '2026-07-06',
      end_date: '2026-07-10',
    };

    const { rerender } = render(
      <TemplateRenderer
        spec={SAMPLE_TEMPLATE_SPEC}
        values={initialValues}
      />
    );

    expect(screen.getByText('MR. SOUMALYA MUKHERJEE')).toBeDefined();
    expect(screen.queryByText('ALICE NAKAMOTO')).toBeNull();

    // Re-render with new values
    const updatedValues = {
      ...initialValues,
      recipient_name: 'Alice Nakamoto',
      role_verb: 'participated',
      event_name: 'Applied Cryptography Workshop',
    };

    rerender(
      <TemplateRenderer
        spec={SAMPLE_TEMPLATE_SPEC}
        values={updatedValues}
      />
    );

    expect(screen.getByText('Alice Nakamoto')).toBeDefined();
    expect(screen.getByText(/participated/)).toBeDefined();
    expect(screen.getByText(/Applied Cryptography Workshop/)).toBeDefined();
    expect(screen.queryByText('MR. SOUMALYA MUKHERJEE')).toBeNull();
  });
});
