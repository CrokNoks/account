export function formatCurrency(amountCents: string | number): string {
  const amount = typeof amountCents === 'string' ? parseInt(amountCents, 10) : amountCents;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount / 100);
}
