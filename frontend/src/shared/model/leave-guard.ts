/**
 * Garde de sortie : un écran qui a des saisies non enregistrées l'enregistre ici ; les endroits qui
 * changent de compte (sélecteur de compte) demandent `confirmLeave()` avant d'agir.
 */
let guard: { isDirty: () => boolean; message: string } | null = null;

/** Enregistre la garde ; renvoie la fonction qui la retire. */
export function registerLeaveGuard(isDirty: () => boolean, message: string): () => void {
  const mine = { isDirty, message };
  guard = mine;
  return () => {
    if (guard === mine) guard = null;
  };
}

/** True si on peut quitter : pas de saisie, ou l'utilisateur a accepté de l'abandonner. */
export function confirmLeave(): boolean {
  if (!guard || !guard.isDirty()) return true;
  return window.confirm(guard.message);
}
