import { describe, it, expect } from 'vitest';
import { parseTokens, substituteTokens, renderRichSegments } from './tokens';

describe('tokens.ts parser and substitution', () => {
  it('parses simple tokens and formatted tokens', () => {
    const text = 'Hello {{recipient_name}}, event is {{event_date|MMMM Do}}!';
    const tokens = parseTokens(text);
    expect(tokens.map((t) => ({ key: t.key, format: t.format, raw: t.raw }))).toEqual([
      { key: 'recipient_name', format: undefined, raw: '{{recipient_name}}' },
      { key: 'event_date', format: 'MMMM Do', raw: '{{event_date|MMMM Do}}' },
    ]);
  });

  it('substitutes basic values and preserves unknown keys gracefully', () => {
    const text = 'Certificate of {{role_verb}} for {{recipient_name}} (ID: {{unknown_key}})';
    const values = {
      role_verb: 'Participation',
      recipient_name: 'Alice Nakamoto',
    };
    const result = substituteTokens(text, values);
    expect(result).toBe('Certificate of Participation for Alice Nakamoto (ID: {{unknown_key}})');
  });

  it('formats dates using pipe modifier', () => {
    const text = 'Held on {{date|MMMM DDo, YYYY}}';
    const values = { date: '2026-07-06' };
    const result = substituteTokens(text, values);
    expect(result).toBe('Held on July 06th, 2026');
  });

  it('renders rich segments with token styles', () => {
    const text = 'This is to certify that {{recipient_name}} completed the course.';
    const values = { recipient_name: 'Bob' };
    const tokenStyles = {
      recipient_name: { fontWeight: 700 as const, color: '#065F46' },
    };

    const segments = renderRichSegments(text, values, tokenStyles);
    expect(segments).toEqual([
      { text: 'This is to certify that ', isToken: false },
      {
        text: 'Bob',
        isToken: true,
        key: 'recipient_name',
        style: { fontWeight: 700, color: '#065F46' },
      },
      { text: ' completed the course.', isToken: false },
    ]);
  });

  it('enforces Invariant I1: missing keys produce [MISSING: key] in issued mode and preserve raw in editor mode', () => {
    const text = 'Recipient: {{recipient_name}}, Event: {{event_name}}';
    const values = { recipient_name: 'Alice' }; // event_name is missing

    // Issued mode
    const issuedSegments = renderRichSegments(text, values, undefined, 'issued');
    expect(issuedSegments).toEqual([
      { text: 'Recipient: ', isToken: false },
      { text: 'Alice', isToken: true, key: 'recipient_name', style: undefined },
      { text: ', Event: ', isToken: false },
      { text: '[MISSING: event_name]', isToken: true, key: 'event_name', isMissing: true, style: undefined },
    ]);

    // Editor mode
    const editorSegments = renderRichSegments(text, values, undefined, 'editor');
    expect(editorSegments).toEqual([
      { text: 'Recipient: ', isToken: false },
      { text: 'Alice', isToken: true, key: 'recipient_name', style: undefined },
      { text: ', Event: ', isToken: false },
      { text: '{{event_name}}', isToken: true, key: 'event_name', style: undefined },
    ]);
  });
});
