import polyglotI18nProvider from 'ra-i18n-polyglot';
import { fr } from './i18n/fr';
import { en } from './i18n/en';

const translations: { [key: string]: any } = { fr, en };

export const i18nProvider = polyglotI18nProvider(
  locale => translations[locale],
  'fr', // Default locale
  [
    { locale: 'fr', name: 'Français' },
    { locale: 'en', name: 'English' },
  ],
  { allowMissing: true }
);
