import type { TourName } from '@/shared/model/use-ui-store';

// Étapes qui attendent l'ouverture d'un panneau (cible absente tant qu'il n'est pas rendu).
const WAITING_STEPS: Partial<Record<TourName, number[]>> = {
  account: [2, 4], // formulaire de création de compte
  transactions: [0], // tiroir de création de transaction
};

/** Index à afficher quand la cible de l'étape est introuvable ; `null` = attendre sur place. */
export function nextIndexOnMissingTarget(tour: TourName, index: number, action: 'next' | 'prev'): number | null {
  if (WAITING_STEPS[tour]?.includes(index)) return null;
  return index + (action === 'prev' ? -1 : 1);
}
