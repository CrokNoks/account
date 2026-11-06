import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

/** « janv. 26 » : libellé court d'une période, d'après sa date de début. */
export function shortPeriodLabel(startDate: string, locale: string): string {
  return format(new Date(startDate), 'MMM yy', { locale: locale === 'fr' ? fr : enUS });
}

/** « janvier 2026 » : libellé long d'une période, d'après sa date de début. */
export function longPeriodLabel(startDate: string, locale: string): string {
  return format(new Date(startDate), 'MMMM yyyy', { locale: locale === 'fr' ? fr : enUS });
}
