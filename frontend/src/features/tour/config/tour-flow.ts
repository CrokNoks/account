import type { TourName } from '@/shared/model/use-ui-store';

// Étapes qui attendent l'ouverture d'un panneau (cible absente tant qu'il n'est pas rendu).
const WAITING_STEPS: Partial<Record<TourName, number[]>> = {
  account: [2], // formulaire de création de compte
  transactions: [0], // tiroir de création de transaction
};

/** Index à afficher quand la cible de l'étape est introuvable ; `null` = attendre sur place. */
export function nextIndexOnMissingTarget(tour: TourName, index: number, action: 'next' | 'prev'): number | null {
  if (WAITING_STEPS[tour]?.includes(index)) return null;
  return index + (action === 'prev' ? -1 : 1);
}

export type AccountDialogAction = 'open' | 'close' | null;

/**
 * Ouverture/fermeture du dialogue de création de compte quand on quitte une étape de la visite « compte ».
 * Bureau : fermé en sortant de l'étape 4. Mobile : fermé dès la sortie de l'étape 3 (solde), sinon il masque
 * la barre du bas où l'étape « Plus » (4) pointe.
 */
export function accountDialogAction(index: number, action: 'next' | 'prev', desktop: boolean): AccountDialogAction {
  if (index === 1 && action === 'next') return 'open';
  if (index === 2 && action === 'prev') return 'close';
  const lastInDialog = desktop ? 4 : 3;
  if (index === lastInDialog && action === 'next') return 'close';
  if (index === lastInDialog + 1 && action === 'prev') return 'open';
  return null;
}
