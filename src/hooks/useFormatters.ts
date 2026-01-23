// Cache pour les formatters afin d'éviter la recréation
const numberFormatterCache = new Map<string, Intl.NumberFormat>();
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

export const getCurrencyFormatter = (locale: string = 'fr-FR') => {
  if (!numberFormatterCache.has(locale)) {
    numberFormatterCache.set(locale, new Intl.NumberFormat(locale, { 
      style: 'currency', 
      currency: 'EUR' 
    }));
  }
  return numberFormatterCache.get(locale)!;
};

export const getDateFormatter = (locale: string = 'fr-FR') => {
  if (!dateFormatterCache.has(locale)) {
    dateFormatterCache.set(locale, new Intl.DateTimeFormat(locale));
  }
  return dateFormatterCache.get(locale)!;
};

export const getNumberFormatter = (locale: string = 'fr-FR') => {
  const cacheKey = `number-${locale}`;
  if (!numberFormatterCache.has(cacheKey)) {
    numberFormatterCache.set(cacheKey, new Intl.NumberFormat(locale));
  }
  return numberFormatterCache.get(cacheKey)!;
};

// Formatters optimisés par défaut
export const formatCurrency = (amount: number, locale: string = 'fr-FR') => {
  return getCurrencyFormatter(locale).format(amount);
};

export const formatDate = (date: string | Date, locale: string = 'fr-FR') => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return getDateFormatter(locale).format(dateObj);
};

export const formatNumber = (num: number, locale: string = 'fr-FR') => {
  return getNumberFormatter(locale).format(num);
};