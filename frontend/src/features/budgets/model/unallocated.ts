import { presentAmount, type AmountTone } from '@/features/reporting/lib/signed-amount';

/** « Non réparti » : revenus prévus moins total budgété, en centimes entiers (bigint, jamais de flottant). */
export function unallocated(plannedIncome: string, plannedExpenses: string): bigint {
  return BigInt(plannedIncome) - BigInt(plannedExpenses);
}

/**
 * Texte et teinte de « Non réparti » (règle des soldes : « - » et orange si négatif).
 * `null` si un des deux montants manque : on n'affiche pas un 0,00 faux.
 */
export function presentUnallocated(
  plannedIncome: string | undefined,
  plannedExpenses: string | undefined,
  locale: string,
): { text: string; tone: AmountTone } | null {
  if (plannedIncome === undefined || plannedExpenses === undefined) return null;
  return presentAmount(unallocated(plannedIncome, plannedExpenses), 'balance', locale);
}
