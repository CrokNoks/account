import { formatCurrency } from '@/shared/lib/format';

/** Montant en centimes avec son signe toujours écrit (« +3 200,00 € », « -800,00 € »), jamais par la couleur seule. */
export function formatSignedAmount(cents: string | bigint): string {
  const value = BigInt(cents);
  const formatted = formatCurrency(value.toString());
  return value > BigInt(0) ? `+${formatted}` : formatted;
}
