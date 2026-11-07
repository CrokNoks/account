import { describe, expect, it } from 'vitest';
import { periodProgress } from './period-progress';

describe('periodProgress', () => {
  it('compte les jours bornes comprises', () => {
    expect(periodProgress('2026-11-01', '2026-11-30', '2026-11-01')).toEqual({ day: 1, total: 30, ratio: 1 / 30 });
    expect(periodProgress('2026-11-01', '2026-11-30', '2026-11-15')).toEqual({ day: 15, total: 30, ratio: 0.5 });
    expect(periodProgress('2026-11-01', '2026-11-30', '2026-11-30')).toEqual({ day: 30, total: 30, ratio: 1 });
  });

  it('lit les dates ISO à minuit UTC sans décalage de fuseau', () => {
    expect(periodProgress('2026-11-01T00:00:00.000Z', '2026-11-30T00:00:00.000Z', '2026-11-02')?.day).toBe(2);
  });

  it('traverse un changement d\'heure sans perdre un jour', () => {
    expect(periodProgress('2026-10-01', '2026-10-31', '2026-10-31')).toEqual({ day: 31, total: 31, ratio: 1 });
  });

  it('masque une période passée, à venir, sans fin ou illisible', () => {
    expect(periodProgress('2026-10-01', '2026-10-31', '2026-11-01')).toBeNull();
    expect(periodProgress('2026-12-01', '2026-12-31', '2026-11-30')).toBeNull();
    expect(periodProgress('2026-11-01', null, '2026-11-10')).toBeNull();
    expect(periodProgress('2026-11-01', '', '2026-11-10')).toBeNull();
    expect(periodProgress('2026-11-30', '2026-11-01', '2026-11-10')).toBeNull();
    expect(periodProgress('abc', '2026-11-30', '2026-11-10')).toBeNull();
  });
});
