import { describe, expect, it } from 'vitest';
import { formatDateOnly, todayDateOnly } from './date-only';

describe('formatDateOnly', () => {
  it('uses the format of the active language', () => {
    expect(formatDateOnly('2026-10-01', 'fr')).toBe('01/10/2026');
    expect(formatDateOnly('2026-10-01', 'en')).toBe('10/01/2026');
  });

  it('reads the calendar day of an ISO string at midnight UTC', () => {
    expect(formatDateOnly('2026-10-01T00:00:00.000Z', 'fr')).toBe('01/10/2026');
  });

  it('returns unreadable values unchanged', () => {
    expect(formatDateOnly('31/02/2026', 'fr')).toBe('31/02/2026');
    expect(formatDateOnly('', 'fr')).toBe('');
  });
});

describe('todayDateOnly', () => {
  it('is the local calendar date, not the UTC one', () => {
    // Local fields on purpose: 1st November 00:30 on the machine, whatever its time zone.
    expect(todayDateOnly(new Date(2026, 10, 1, 0, 30))).toBe('2026-11-01');
    expect(todayDateOnly(new Date(2026, 9, 31, 23, 30))).toBe('2026-10-31');
  });
});
