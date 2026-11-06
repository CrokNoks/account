import { describe, expect, it } from 'vitest';
import { buildOverrunsGrid } from './overruns-grid';
import type { PeriodOverruns } from './types';

const period = (n: number, overruns: Array<[string, string]> = []): PeriodOverruns => ({
  periodId: `p${n}`,
  startDate: `2026-${String(n).padStart(2, '0')}-01T00:00:00.000Z`,
  endDate: `2026-${String(n).padStart(2, '0')}-28T00:00:00.000Z`,
  overruns: overruns.map(([categoryId, overrun]) => ({
    categoryId,
    name: categoryId.toUpperCase(),
    budget: '10000',
    real: '-20000',
    overrun,
  })),
});

describe('buildOverrunsGrid (règle critique : le tableau Dépassements)', () => {
  it('aucun dépassement : aucune ligne, mais toutes les périodes gardent leur colonne', () => {
    const grid = buildOverrunsGrid([period(2), period(1)]);
    expect(grid.columns.map((c) => c.periodId)).toEqual(['p1', 'p2']);
    expect(grid.rows).toEqual([]);
  });

  it('aucune période fermée : grille vide', () => {
    expect(buildOverrunsGrid([])).toEqual({ columns: [], rows: [] });
  });

  it('un seul dépassement : la case porte le montant du back tel quel, les autres sont absentes', () => {
    const grid = buildOverrunsGrid([period(1), period(2, [['courses', '2000']]), period(3)]);
    expect(grid.columns).toHaveLength(3);
    expect(grid.rows).toEqual([
      { categoryId: 'courses', name: 'COURSES', cells: [null, '2000', null], total: '2000' },
    ]);
  });

  it('catégorie dépassant une période sur deux : cases vides = null, total = somme des cases', () => {
    const grid = buildOverrunsGrid([
      period(1, [['courses', '2000']]),
      period(2),
      period(3, [['courses', '1550']]),
      period(4),
    ]);
    expect(grid.rows[0].cells).toEqual(['2000', null, '1550', null]);
    expect(grid.rows[0].total).toBe('3550');
  });

  it('colonnes en ordre chronologique même si le back les renvoie de la plus récente à la plus ancienne', () => {
    const grid = buildOverrunsGrid([period(3, [['a', '100']]), period(2), period(1, [['a', '50']])]);
    expect(grid.columns.map((c) => c.periodId)).toEqual(['p1', 'p2', 'p3']);
    expect(grid.rows[0].cells).toEqual(['50', null, '100']);
  });

  it("total en centimes entiers exact au-delà de la précision d'un flottant (bigint)", () => {
    const grid = buildOverrunsGrid([
      period(1, [['a', '9007199254740993']]),
      period(2, [['a', '2']]),
    ]);
    expect(grid.rows[0].total).toBe('9007199254740995');
  });

  it('plusieurs catégories : triées par total décroissant puis par nom', () => {
    const grid = buildOverrunsGrid([
      period(1, [['b', '500'], ['a', '500'], ['c', '9000']]),
    ]);
    expect(grid.rows.map((r) => r.categoryId)).toEqual(['c', 'a', 'b']);
  });

  it('au plus les 6 dernières périodes ; une catégorie dépassant seulement plus tôt disparaît, les totaux ne comptent que les cases affichées', () => {
    const periods = [1, 2, 3, 4, 5, 6, 7].map((n) =>
      period(n, n === 1 ? [['vieille', '999']] : n >= 6 ? [['courses', '100']] : []),
    );
    const grid = buildOverrunsGrid(periods);
    expect(grid.columns.map((c) => c.periodId)).toEqual(['p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
    expect(grid.rows.map((r) => r.categoryId)).toEqual(['courses']);
    expect(grid.rows[0].total).toBe('200');
  });

  it("un excédent de 0 ou négatif renvoyé par erreur n'est pas une case", () => {
    const grid = buildOverrunsGrid([period(1, [['a', '0']])]);
    expect(grid.rows).toEqual([]);
  });
});
