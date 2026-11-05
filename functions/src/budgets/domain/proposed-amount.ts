/**
 * Montant proposé pour une catégorie, en centimes (bigint).
 * Règle écrite une seule fois : le montant configuré l'emporte ; 0 équivaut à « non configuré ».
 */

/** Création de période : montant configuré, sinon 0 (jamais de moyenne ni de récurrentes). */
export function proposedAmountForPeriod(
  configured: bigint | undefined,
): bigint {
  return configured ?? 0n;
}

/** Écran de configuration : configuré non nul, sinon somme des récurrentes (0 s'il n'y en a pas). */
export function proposedAmountForConfigScreen(
  configured: bigint | undefined,
  recurringAmounts: bigint[],
): bigint {
  if (configured !== undefined && configured !== 0n) return configured;
  return recurringAmounts.reduce((sum, amount) => sum + amount, 0n);
}
