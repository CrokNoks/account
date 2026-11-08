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

/** `ink` : encre (`--foreground`), `warn` : orange d'alerte (`--warn`). Jamais de vert ni de rouge sur un montant. */
export type AmountTone = 'ink' | 'warn';

/** `balance` : un solde (seul le « - » d'un négatif s'écrit) ; `flow` : une opération ou une échéance (« + » d'une entrée d'argent). */
export type AmountKind = 'balance' | 'flow';

export const TONE_CLASS: Record<AmountTone, string> = { ink: 'text-foreground', warn: 'text-warn' };

/** Barre de budget : accent bleu tant que le budget tient, orange quand il est dépassé. */
export const budgetBarClass = (over: boolean): string => (over ? 'bg-warn' : 'bg-primary');

/**
 * Texte et teinte d'un montant en centimes, règle unique de tous les écrans. Les chiffres sont ceux de
 * `formatCurrency` ; seuls le « + » d'un flux et la teinte changent. Un solde négatif est orange (le « - »
 * reste écrit) ; un flux, même négatif, est une dépense normale : encre.
 */
export function presentAmount(
  cents: string | bigint,
  kind: AmountKind,
  locale = 'fr',
): { text: string; tone: AmountTone } {
  const value = BigInt(cents);
  if (kind === 'flow') return { text: formatSignedAmount(value, locale), tone: 'ink' };
  return { text: formatCurrency(value, locale), tone: value < BigInt(0) ? 'warn' : 'ink' };
}

/** `presentAmount` lié à la langue de l'interface, avec la classe de couleur prête (à appeler dans un composant). */
export function usePresentAmount(): (cents: string | bigint, kind: AmountKind) => { text: string; tone: AmountTone; className: string } {
  const locale = useLocale();
  return (cents, kind) => {
    const presented = presentAmount(cents, kind, locale);
    return { ...presented, className: TONE_CLASS[presented.tone] };
  };
}
