import { describe, expect, it } from 'vitest';
import { closedPeriodsChronological, cumulativeCents, defaultComparison, lastClosed, validCompareWith } from './analysis-periods';

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

describe('validCompareWith', () => {
  const periods = [mk(1), mk(2), mk(3), mk(4, true)];

  it('garde une comparaison différente de la période affichée', () => {
    expect(validCompareWith(periods, 'p3', 'p1')).toBe('p1');
    expect(validCompareWith(periods, 'p3', null)).toBeNull();
  });

  it('remplace la période elle-même par la précédente disponible', () => {
    expect(validCompareWith(periods, 'p3', 'p3')).toBe('p2');
  });

  it("n'a aucune comparaison quand la période est la plus ancienne", () => {
    expect(validCompareWith(periods, 'p1', 'p1')).toBeNull();
  });
});

describe('cumulativeCents (dépenses cumulées)', () => {
  it('100 € puis 100 € : 100 €, 200 €', () => {
    expect(cumulativeCents([BigInt(10000), BigInt(10000)])).toEqual([BigInt(10000), BigInt(20000)]);
  });

  it('somme exacte en centimes, sans arrondi', () => {
    expect(cumulativeCents([BigInt(1), BigInt(2), BigInt(3)])).toEqual([BigInt(1), BigInt(3), BigInt(6)]);
  });

  it('une période à 0 fait stagner le cumul sans le faire baisser', () => {
    expect(cumulativeCents([BigInt(5000), BigInt(0), BigInt(2500)])).toEqual([BigInt(5000), BigInt(5000), BigInt(7500)]);
  });

  it('une seule période : le cumul égale son total ; aucune période : rien', () => {
    expect(cumulativeCents([BigInt(4200)])).toEqual([BigInt(4200)]);
    expect(cumulativeCents([])).toEqual([]);
  });

  it('fenêtre réduite : le cumul repart de zéro à la plus ancienne période de la fenêtre', () => {
    const amounts = [BigInt(10000), BigInt(20000), BigInt(30000), BigInt(40000)];
    expect(cumulativeCents(lastClosed(amounts, 3))).toEqual([BigInt(20000), BigInt(50000), BigInt(90000)]);
  });
});

describe('lastClosed (fenêtre des N dernières)', () => {
  it('garde les N dernières, dans l’ordre', () => {
    expect(lastClosed([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
  });

  it('moins de périodes que la fenêtre : toutes sont gardées', () => {
    expect(lastClosed([1, 2], 12)).toEqual([1, 2]);
    expect(lastClosed([], 3)).toEqual([]);
  });
});
