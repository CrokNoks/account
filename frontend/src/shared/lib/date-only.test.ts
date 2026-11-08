import { describe, expect, it } from 'vitest';
import { formatDateOnly, formatShortDate, formatShortRange, todayDateOnly } from './date-only';

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

describe('formatShortDate', () => {
  const now = new Date(2026, 10, 8);

  it('écrit le jour et le mois selon la langue, sans année pour l\'année en cours', () => {
    expect(formatShortDate('2026-11-06', 'fr', now)).toBe('6 nov.');
    expect(formatShortDate('2026-11-06', 'en', now)).toBe('Nov 6');
  });

  it('lit le jour calendaire d\'une chaîne ISO à minuit UTC', () => {
    expect(formatShortDate('2026-11-06T00:00:00.000Z', 'fr', now)).toBe('6 nov.');
  });

  it('ajoute l\'année quand elle diffère de l\'année en cours', () => {
    expect(formatShortDate('2025-11-06', 'fr', now)).toBe('6 nov. 2025');
    expect(formatShortDate('2025-11-06', 'en', now)).toBe('Nov 6, 2025');
  });

  it('rend une valeur illisible telle quelle', () => {
    expect(formatShortDate('n/a', 'fr', now)).toBe('n/a');
  });
});

describe('formatShortRange', () => {
  const now = new Date(2026, 10, 8);

  it('relie deux dates courtes par une flèche', () => {
    expect(formatShortRange('2026-10-25', '2026-11-24', 'fr', now)).toBe('25 oct. → 24 nov.');
    expect(formatShortRange('2026-10-25', '2026-11-24', 'en', now)).toBe('Oct 25 → Nov 24');
  });

  it('porte l\'année des bornes d\'une autre année', () => {
    expect(formatShortRange('2025-12-25', '2026-01-24', 'fr', now)).toBe('25 déc. 2025 → 24 janv.');
  });
});
