import { describe, it, expect } from 'vitest';
import { formatDate, getOrdinalSuffix } from './dates';

describe('dates.ts custom formatter', () => {
  it('correctly calculates ordinal suffixes for all numbers', () => {
    expect(getOrdinalSuffix(1)).toBe('1st');
    expect(getOrdinalSuffix(2)).toBe('2nd');
    expect(getOrdinalSuffix(3)).toBe('3rd');
    expect(getOrdinalSuffix(4)).toBe('4th');
    expect(getOrdinalSuffix(11)).toBe('11th');
    expect(getOrdinalSuffix(12)).toBe('12th');
    expect(getOrdinalSuffix(13)).toBe('13th');
    expect(getOrdinalSuffix(21)).toBe('21st');
    expect(getOrdinalSuffix(22)).toBe('22nd');
    expect(getOrdinalSuffix(23)).toBe('23rd');
    expect(getOrdinalSuffix(31)).toBe('31st');
  });

  it('formats July 06th with zero-padded ordinal token DDo', () => {
    const formatted = formatDate('2026-07-06', 'MMMM DDo');
    expect(formatted).toBe('July 06th');
  });

  it('formats July 10th, 2026', () => {
    const formatted = formatDate('2026-07-10', 'MMMM Do, YYYY');
    expect(formatted).toBe('July 10th, 2026');
  });

  it('handles invalid dates gracefully by returning original input', () => {
    expect(formatDate('not-a-date', 'YYYY-MM-DD')).toBe('not-a-date');
  });
});
