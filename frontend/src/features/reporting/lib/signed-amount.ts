import { useLocale } from 'next-intl';
import { formatCurrency } from '@/shared/lib/format';

/** Montant en centimes avec son signe toujours écrit (« +3 200,00 € », « -800,00 € »), jamais par la couleur seule. */
export function formatSignedAmount(cents: string | bigint, locale = 'fr'): string {
  const value = BigInt(cents);
  const formatted = formatCurrency(value, locale);
  return value > BigInt(0) ? `+${formatted}` : formatted;
}

/** `formatSignedAmount` lié à la langue de l'interface (à appeler dans un composant). */
export function useFormatSignedAmount(): (cents: string | bigint) => string {
  const locale = useLocale();
  return (cents) => formatSignedAmount(cents, locale);
}
