import { useMemo } from 'react';

// Cache pour les formatters afin d'éviter la recréation
const formatterCache = new Map<string, Intl.NumberFormat>();

export const getCurrencyFormatter = (locale: string = 'fr-FR') => {
  if (!formatterCache.has(locale)) {
    formatterCache.set(locale, new Intl.NumberFormat(locale, { 
      style: 'currency', 
      currency: 'EUR' 
    }));
  }
  return formatterCache.get(locale)!;
};

export const getDateFormateter = (locale: string = 'fr-FR') => {
  const cacheKey = `date-${locale}`;
  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.DateTimeFormat(locale));
  }
  return formatterCache.get(cacheKey)!;
};

// Formatters optimisés par défaut
export const formatCurrency = (amount: number, locale: string = 'fr-FR') => {
  return getCurrencyFormatter(locale).format(amount);
};

export const formatDate = (date: string | Date, locale: string = 'fr-FR') => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return getDateFormateter(locale).format(dateObj);
};

export const formatNumber = (num: number, locale: string = 'fr-FR') => {
  const cacheKey = `number-${locale}`;
  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.NumberFormat(locale));
  }
  return formatterCache.get(cacheKey)!.format(num);
};