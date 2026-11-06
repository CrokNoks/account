import { describe, expect, it } from 'vitest';
import { closedPeriodsChronological, defaultComparison } from './analysis-periods';

const mk = (n: number, isActive = false) => ({
  id: `p${n}`,
  startDate: `2026-${String(n).padStart(2, '0')}-01T00:00:00.000Z`,
  endDate: `2026-${String(n).padStart(2, '0')}-28T00:00:00.000Z`,
  isActive,
});

describe('closedPeriodsChronological', () => {
  it('garde les périodes fermées, de la plus ancienne à la plus récente', () => {
    expect(closedPeriodsChronological([mk(3), mk(1), mk(4, true), mk(2)]).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(closedPeriodsChronological(undefined)).toEqual([]);
  });
});

describe('defaultComparison (choix par défaut de Répartition)', () => {
  it('aucune période fermée : rien à choisir, même avec une période active', () => {
    expect(defaultComparison([])).toEqual({ periodId: null, compareWithId: null });
    expect(defaultComparison([mk(1, true)])).toEqual({ periodId: null, compareWithId: null });
  });

  it('une seule période fermée : elle est affichée, sans comparaison', () => {
    expect(defaultComparison([mk(1), mk(2, true)])).toEqual({ periodId: 'p1', compareWithId: null });
  });

  it('deux périodes fermées : la dernière face à la précédente', () => {
    expect(defaultComparison([mk(2), mk(1)])).toEqual({ periodId: 'p2', compareWithId: 'p1' });
  });

  it("plus de deux : la dernière fermée face à l'avant-dernière ; la période active n'est jamais choisie", () => {
    expect(defaultComparison([mk(1), mk(2), mk(3), mk(4, true)])).toEqual({ periodId: 'p3', compareWithId: 'p2' });
  });
});
