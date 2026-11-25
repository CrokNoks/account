/**
 * Règle unique de l'état « en attente » à la modification (simple ou en lot) :
 * pointer une transaction (`reconciled: true`) la sort toujours de l'attente,
 * même si `pending` est fourni dans la même requête ; sinon `pending` fourni
 * est appliqué, à défaut l'état existant est conservé.
 */
export function resolvePending(
  reconciled: boolean | undefined,
  pending: boolean | undefined,
  existingPending: boolean,
): boolean {
  if (reconciled === true) return false;
  return pending ?? existingPending;
}

/** Vrai pour la seule transition `pending` → non `pending` (pointer, décocher, lot). */
export function isLeavingPending(before: boolean, after: boolean): boolean {
  return before && !after;
}
