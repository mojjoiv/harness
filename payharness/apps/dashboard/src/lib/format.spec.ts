import { dateTime, money } from './format';

describe('format helpers', () => {
  it('formats money from cents', () => {
    expect(money(12500, 'USD')).toBe('$125.00');
    expect(money(999, 'KES')).toContain('KES');
  });

  it('returns Never for missing dates', () => {
    expect(dateTime()).toBe('Never');
    expect(dateTime(null)).toBe('Never');
  });

  it('formats a valid date', () => {
    expect(dateTime('2026-01-15T12:30:00.000Z')).toMatch(/Jan 15, 2026/);
  });
});
