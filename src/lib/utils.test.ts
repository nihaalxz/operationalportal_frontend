import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatAmount, truncate, capitalize } from '$lib/utils';

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2024-06-15T00:00:00');
    expect(result).toContain('15');
    expect(result).toContain('Jun');
    expect(result).toContain('2024');
  });

  it('returns dash for null', () => expect(formatDate(null)).toBe('—'));
  it('returns dash for undefined', () => expect(formatDate(undefined)).toBe('—'));
  it('returns dash for empty string', () => expect(formatDate('')).toBe('—'));
});

describe('formatAmount', () => {
  it('formats a number as BHD currency with 3 decimal places', () => {
    const result = formatAmount(1500.5);
    expect(result).toContain('BHD');
    expect(result).toContain('1,500');
    expect(result).toContain('500'); // 3 decimal places: 1,500.500
  });

  it('returns dash for null', () => expect(formatAmount(null)).toBe('—'));
  it('returns dash for undefined', () => expect(formatAmount(undefined)).toBe('—'));
  it('formats zero with 3 decimals', () => {
    const result = formatAmount(0);
    expect(result).toContain('0');
    expect(result).toContain('BHD');
  });
});

describe('truncate', () => {
  it('truncates strings longer than max', () => {
    const long = 'A'.repeat(60);
    const result = truncate(long, 40);
    expect(result.length).toBeLessThanOrEqual(41); // 40 chars + ellipsis
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns unchanged short strings', () => {
    const short = 'Hello';
    expect(truncate(short, 40)).toBe('Hello');
  });

  it('returns dash for null', () => expect(truncate(null)).toBe('—'));
});

describe('capitalize', () => {
  it('capitalizes first letter', () => expect(capitalize('hello')).toBe('Hello'));
  it('handles already capitalized', () => expect(capitalize('ADMIN')).toBe('Admin'));
  it('returns empty string for null', () => expect(capitalize(null)).toBe(''));
});
