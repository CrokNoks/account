/**
 * Règle partagée par la trésorerie et le calendrier : une récurrence est « déjà payée »
 * un jour donné si une transaction du même jour a le même montant et un libellé qui
 * contient le sien (casse ignorée). Ni le statut (pending, rapprochée) ni la catégorie
 * ne comptent. Une transaction peut écarter plusieurs récurrences identiques.
 * Montants en centimes (bigint).
 */
export function isRecurringAlreadyPaid(
  recurring: { description: string; amount: bigint },
  day: Date,
  transactions: { date: Date; description: string; amount: bigint }[],
): boolean {
  const label = recurring.description.toLowerCase();
  return transactions.some(
    (t) =>
      t.date.getTime() === day.getTime() &&
      t.description.toLowerCase().includes(label) &&
      t.amount === recurring.amount,
  );
}
