// Formatters constants - cached to avoid recreation
const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR');
const CURRENCY_FORMATTER = new Intl.NumberFormat('fr-FR', { 
  style: 'currency', 
  currency: 'EUR' 
});

// Optimized formatter functions
export const formatDate = (dateStr: string) => DATE_FORMATTER.format(new Date(dateStr));
export const formatCurrency = (amount: number) => CURRENCY_FORMATTER.format(amount);