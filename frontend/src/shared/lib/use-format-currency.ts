import { useLocale } from 'next-intl';
import { formatCurrency } from './format';

/** `formatCurrency` lié à la langue de l'interface : à appeler dans un composant, à la place de l'import direct. */
export function useFormatCurrency(): (amountCents: string | number | bigint) => string {
  const locale = useLocale();
  return (amountCents) => formatCurrency(amountCents, locale);
}
