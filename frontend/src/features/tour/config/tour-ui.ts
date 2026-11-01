import type { Locale, Styles } from 'react-joyride';

type Translate = (key: string) => string;

// Libellés de la bulle. `nextLabelWithProgress` doit être fourni : sans lui,
// Joyride affiche « Next (Step 2 of 6) » en anglais dès que showProgress est actif.
export const tourLocale = (tc: Translate, nextWithProgress: string): Locale => ({
  back: tc('back'),
  close: tc('close'),
  last: tc('finish'),
  next: tc('next'),
  nextLabelWithProgress: nextWithProgress,
  skip: tc('skip'),
});

// Les variables CSS du thème sont en oklch : ne pas les envelopper dans hsl().
export const tourStyles = (dark: boolean): Partial<Styles> => ({
  options: {
    primaryColor: 'var(--primary)',
    backgroundColor: dark ? '#1f2937' : '#fff',
    textColor: dark ? '#f3f4f6' : '#1f2937',
    arrowColor: dark ? '#1f2937' : '#fff',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  tooltip: {
    borderRadius: '0.75rem',
    padding: '1.25rem',
  },
  buttonNext: {
    color: 'var(--primary-foreground)',
    borderRadius: '0.5rem',
    padding: '0.5rem 1rem',
    fontWeight: 600,
  },
  buttonBack: {
    marginRight: '0.75rem',
  },
});
