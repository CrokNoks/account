import { CategoryType } from '../../categories/domain/category.entity';
import { addDaysDateOnly, toDateOnly } from '../../shared/domain/date-only';

/**
 * Rythme de dépense : cumul quotidien des sorties d'argent. Fonction pure,
 * centimes entiers, dates calendaires UTC.
 *
 * Une transaction compte si elle n'est pas `pending` ET :
 *  - sa catégorie est une dépense ou de l'épargne (montant net signé,
 *    remboursements inclus), ou
 *  - elle n'a pas de catégorie et son montant est négatif.
 * Revenus, virements catégorisés et catégories inconnues sont exclus.
 */

export interface PaceTransaction {
  date: Date;
  amount: bigint;
  categoryId: string | null;
  pending: boolean;
}

export interface PaceWindow {
  start: Date;
  /** Nombre de jours de la fenêtre (0 : vide). */
  days: number;
  transactions: PaceTransaction[];
}

export interface PacePoint {
  day: number;
  date: string;
  cumulative: bigint;
  previousCumulative: bigint | null;
}

export interface SpendingPace {
  points: PacePoint[];
  /** cumul courant - cumul précédent au dernier jour ; null sans précédente ou sans point. */
  gap: bigint | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isOutflow(
  t: PaceTransaction,
  types: Map<string, CategoryType>,
): boolean {
  if (t.pending) return false;
  if (!t.categoryId) return t.amount < 0n;
  const type = types.get(t.categoryId);
  return type === CategoryType.EXPENSE || type === CategoryType.SAVINGS;
}

/** Cumul des sorties (positif = argent sorti) pour chacun des `days` jours. */
function cumulate(
  window: PaceWindow,
  types: Map<string, CategoryType>,
): bigint[] {
  const daily = new Array<bigint>(window.days).fill(0n);
  const startMs = new Date(toDateOnly(window.start)).getTime();
  for (const t of window.transactions) {
    if (!isOutflow(t, types)) continue;
    const index = Math.round(
      (new Date(toDateOnly(t.date)).getTime() - startMs) / DAY_MS,
    );
    if (index < 0 || index >= window.days) continue;
    daily[index] += -t.amount;
  }
  let sum = 0n;
  return daily.map((d) => (sum += d));
}

export function buildSpendingPace(input: {
  start: Date;
  days: number;
  transactions: PaceTransaction[];
  categoryTypes: Map<string, CategoryType>;
  previous: PaceWindow | null;
}): SpendingPace {
  const current = cumulate(
    { start: input.start, days: input.days, transactions: input.transactions },
    input.categoryTypes,
  );
  const previous = input.previous
    ? cumulate(input.previous, input.categoryTypes)
    : null;

  const points: PacePoint[] = current.map((cumulative, i) => ({
    day: i + 1,
    date: toDateOnly(addDaysDateOnly(input.start, i)),
    cumulative,
    previousCumulative: previous
      ? previous.length === 0
        ? 0n
        : previous[Math.min(i, previous.length - 1)]
      : null,
  }));

  const last = points[points.length - 1];
  const gap =
    last && last.previousCumulative !== null
      ? last.cumulative - last.previousCumulative
      : null;
  return { points, gap };
}
