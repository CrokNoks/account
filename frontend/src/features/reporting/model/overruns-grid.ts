import { PeriodOverruns } from './types';

/** Nombre maximal de périodes fermées affichées (les plus récentes). */
export const MAX_GRID_PERIODS = 6;

export interface OverrunsGridColumn {
  periodId: string;
  startDate: string;
  endDate: string;
}

export interface OverrunsGridRow {
  categoryId: string;
  name: string;
  /** Une case par colonne : l'excédent du back en centimes (chaîne), ou null (« — »). */
  cells: Array<string | null>;
  /** Somme exacte des cases, en centimes entiers (chaîne). */
  total: string;
}

export interface OverrunsGrid {
  columns: OverrunsGridColumn[];
  rows: OverrunsGridRow[];
}

/**
 * Tableau catégories × périodes fermées. Chaque case est l'excédent calculé par le back
 * (jamais recalculé ni arrondi) ; une période sans dépassement garde sa colonne ; le total
 * d'une catégorie est la somme bigint de ses cases. Lignes : catégories ayant au moins un
 * dépassement dans les colonnes affichées, du plus gros total au plus petit, puis par nom.
 */
export function buildOverrunsGrid(periods: PeriodOverruns[], maxPeriods = MAX_GRID_PERIODS): OverrunsGrid {
  const shown = [...periods]
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(-maxPeriods);

  const columns = shown.map(({ periodId, startDate, endDate }) => ({ periodId, startDate, endDate }));
  const ZERO = BigInt(0);
  const byCategory = new Map<string, { name: string; cells: Array<bigint | null> }>();

  shown.forEach((period, index) => {
    for (const item of period.overruns) {
      const excess = BigInt(item.overrun);
      if (excess <= ZERO) continue;
      let row = byCategory.get(item.categoryId);
      if (!row) {
        row = { name: item.name, cells: shown.map(() => null) };
        byCategory.set(item.categoryId, row);
      }
      row.cells[index] = excess;
    }
  });

  const rows = [...byCategory.entries()].map(([categoryId, { name, cells }]) => ({
    categoryId,
    name,
    cells: cells.map((c) => (c === null ? null : c.toString())),
    total: cells.reduce<bigint>((sum, c) => sum + (c ?? ZERO), ZERO),
  }));
  rows.sort((a, b) => (a.total === b.total ? a.name.localeCompare(b.name) : a.total > b.total ? -1 : 1));

  return { columns, rows: rows.map((r) => ({ ...r, total: r.total.toString() })) };
}
