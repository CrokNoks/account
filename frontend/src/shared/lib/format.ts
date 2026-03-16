export function formatCurrency(amountCents: string | number): string {
  const amount = typeof amountCents === 'string' ? parseInt(amountCents, 10) : amountCents;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount / 100);
}

/**
 * Converts a string amount (e.g. "10.50") to cents (e.g. "1050").
 * Handles NaN by returning "0".
 */
export function toCents(amount: string): string {
  const parsed = parseFloat(amount.replace(',', '.'));
  if (isNaN(parsed)) return '0';
  return Math.round(parsed * 100).toString();
}

/**
 * Converts a string amount to absolute cents.
 */
export function toAbsCents(amount: string): string {
  const parsed = Math.abs(parseFloat(amount.replace(',', '.')));
  if (isNaN(parsed)) return '0';
  return Math.round(parsed * 100).toString();
}
