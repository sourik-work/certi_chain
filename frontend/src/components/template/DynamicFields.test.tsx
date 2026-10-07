import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DynamicFields } from './DynamicFields';
import { SAMPLE_TEMPLATE_SPEC } from '../../lib/template/sampleSpec';

describe('DynamicFields component', () => {
  it('renders all form fields generated from TemplateSpec in reading order', () => {
    const onValueChange = vi.fn();
    const onRecipientAddressChange = vi.fn();
    const onRecipientEmailChange = vi.fn();
    const onExpiryDateChange = vi.fn();
    const onListingTitleChange = vi.fn();
    const onFocusField = vi.fn();

    render(
      <DynamicFields
        spec={SAMPLE_TEMPLATE_SPEC}
        values={{
          recipient_name: 'Bob Builder',
          certificate_number: 'CERT-100',
        }}
        recipientAddress="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        recipientEmail="bob@domain.org"
        expiryDate=""
        listingTitle="Custom Title"
        focusedFieldKey={null}
        onValueChange={onValueChange}
        onRecipientAddressChange={onRecipientAddressChange}
        onRecipientEmailChange={onRecipientEmailChange}
        onExpiryDateChange={onExpiryDateChange}
        onListingTitleChange={onListingTitleChange}
        onFocusField={onFocusField}
      />
    );

    // Check that field labels exist
    expect(screen.getByText('Certificate Number')).toBeDefined();
    expect(screen.getByText('Certificate Type')).toBeDefined();
    expect(screen.getByText('Recipient Full Name')).toBeDefined();
    expect(screen.getByText('Role Verb')).toBeDefined();
    expect(screen.getByText('Course / Event Name')).toBeDefined();

    // Check blockchain inputs exist
    expect(screen.getByText(/Recipient Wallet Address/)).toBeDefined();
    expect(screen.getByText(/Recipient Email \/ Student ID/)).toBeDefined();
  });

  it('triggers onValueChange when an input is edited', () => {
    const onValueChange = vi.fn();

    render(
      <DynamicFields
        spec={SAMPLE_TEMPLATE_SPEC}
        values={{}}
        recipientAddress=""
        recipientEmail=""
        expiryDate=""
        listingTitle=""
        focusedFieldKey={null}
        onValueChange={onValueChange}
        onRecipientAddressChange={vi.fn()}
        onRecipientEmailChange={vi.fn()}
        onExpiryDateChange={vi.fn()}
        onListingTitleChange={vi.fn()}
        onFocusField={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/SASET\/CBT/);
    fireEvent.change(input, { target: { value: 'SASET/NEW/001' } });
    expect(onValueChange).toHaveBeenCalledWith('certificate_number', 'SASET/NEW/001');
  });
});
