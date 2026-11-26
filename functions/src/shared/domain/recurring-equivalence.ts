/**
 * Équivalence entre une occurrence de récurrente et une transaction sans lien
 * (règle du nettoyage à l'import, `docs/periods.md`) : même catégorie non nulle,
 * même signe, écart de date <= 7 jours. Le montant n'est pas une condition.
 * Partagée par la bascule de période et par Échéances (reporting).
 */

/** Écart maximal, en jours, entre une occurrence et la transaction équivalente. */
export const EQUIVALENT_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Comparable {
  categoryId: string | null | undefined;
  amount: bigint;
  date: Date;
}

export const sign = (n: bigint) => (n > 0n ? 1 : n < 0n ? -1 : 0);

/** Écart signé en jours entre deux dates calendaires (`to - from`). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Même catégorie non nulle, même signe, écart de date <= 7 jours (le montant n'est pas une condition). */
export function isEquivalent(a: Comparable, b: Comparable): boolean {
  return (
    a.categoryId != null &&
    a.categoryId === b.categoryId &&
    sign(a.amount) === sign(b.amount) &&
    Math.abs(daysBetween(a.date, b.date)) <= EQUIVALENT_DAYS
  );
}
