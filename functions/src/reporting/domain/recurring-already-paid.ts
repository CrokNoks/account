import { toDateOnly } from '../../shared/domain/date-only';
import {
  daysBetween,
  isEquivalent,
} from '../../shared/domain/recurring-equivalence';

/**
 * Règle partagée par la trésorerie et le calendrier : quelle transaction règle
 * quelle occurrence d'une récurrente (fonction PURE). Une occurrence est une
 * récurrente à une échéance ; une transaction ne règle qu'une occurrence.
 *
 * 1. Lien : une transaction qui porte `metadata.recurringId` règle l'occurrence
 *    de cette récurrente à son échéance d'origine (`dueDate`, sinon sa date).
 * 2. Équivalence, sur le reste, par paires triées de la plus proche à la plus
 *    éloignée (écart en jours, date de l'occurrence, récurrente, transaction) :
 *    même catégorie non nulle, même signe, écart <= 7 jours. Une récurrente sans
 *    catégorie garde l'ancienne reconnaissance (même jour, même montant, libellé
 *    contenu). Une transaction liée à une autre récurrente existante, ou liée à
 *    la même avec une échéance, n'est jamais éligible.
 * Montants en centimes (bigint).
 */

export interface SettleOccurrence {
  recurringId: string;
  categoryId: string | null;
  description: string;
  amount: bigint;
  date: Date;
}

export interface SettleTransaction {
  id: string;
  date: Date;
  categoryId: string | null;
  description: string;
  amount: bigint;
  /** `metadata.recurringId` */
  recurringId?: string;
  /** `metadata.dueDate` (échéance d'origine) */
  dueDate?: Date;
}

export interface SettledBy {
  txId: string;
  txDate: Date;
}

/** Clé d'une occurrence : récurrente + jour (`YYYY-MM-DD`). */
export function occurrenceKey(recurringId: string, date: Date): string {
  return `${recurringId}|${toDateOnly(date)}`;
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function settleOccurrences(
  occurrences: SettleOccurrence[],
  transactions: SettleTransaction[],
  /** Ids des récurrentes qui existent encore. */
  knownRecurringIds: Set<string>,
): Map<string, SettledBy> {
  const settled = new Map<string, SettledBy>();
  const usedTx = new Set<string>();
  const byKey = new Map(
    occurrences.map((o) => [occurrenceKey(o.recurringId, o.date), o]),
  );

  // 1. Lien : exact, sans concurrence entre récurrentes.
  const linked = transactions
    .filter((t) => t.recurringId && knownRecurringIds.has(t.recurringId))
    .sort((a, b) => byString(a.id, b.id));
  for (const t of linked) {
    const key = occurrenceKey(t.recurringId!, t.dueDate ?? t.date);
    if (byKey.has(key) && !settled.has(key)) {
      settled.set(key, { txId: t.id, txDate: t.date });
      usedTx.add(t.id);
    }
  }

  // 2. Équivalence : paires candidates, affectation gloutonne la plus proche d'abord.
  const pairs: { gap: number; occ: SettleOccurrence; tx: SettleTransaction }[] =
    [];
  for (const occ of occurrences) {
    if (settled.has(occurrenceKey(occ.recurringId, occ.date))) continue;
    for (const tx of transactions) {
      if (usedTx.has(tx.id) || !isEligible(tx, occ, knownRecurringIds))
        continue;
      if (!matches(occ, tx)) continue;
      pairs.push({
        gap: Math.abs(daysBetween(occ.date, tx.date)),
        occ,
        tx,
      });
    }
  }
  pairs.sort(
    (a, b) =>
      a.gap - b.gap ||
      a.occ.date.getTime() - b.occ.date.getTime() ||
      byString(a.occ.recurringId, b.occ.recurringId) ||
      byString(a.tx.id, b.tx.id),
  );
  for (const { occ, tx } of pairs) {
    const key = occurrenceKey(occ.recurringId, occ.date);
    if (settled.has(key) || usedTx.has(tx.id)) continue;
    settled.set(key, { txId: tx.id, txDate: tx.date });
    usedTx.add(tx.id);
  }
  return settled;
}

function isEligible(
  tx: SettleTransaction,
  occ: SettleOccurrence,
  knownRecurringIds: Set<string>,
): boolean {
  if (!tx.recurringId || !knownRecurringIds.has(tx.recurringId)) return true;
  // Liée à la même récurrente : seulement sans échéance d'origine (ancienne transaction).
  return tx.recurringId === occ.recurringId && tx.dueDate === undefined;
}

function matches(occ: SettleOccurrence, tx: SettleTransaction): boolean {
  if (occ.categoryId !== null) return isEquivalent(occ, tx);
  // H2 : sans catégorie, ancienne reconnaissance.
  return (
    tx.date.getTime() === occ.date.getTime() &&
    tx.amount === occ.amount &&
    tx.description.toLowerCase().includes(occ.description.toLowerCase())
  );
}
