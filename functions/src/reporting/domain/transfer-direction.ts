/**
 * Sens d'une catégorie de type virement (docs/reporting.md). Règle écrite une seule fois : le back
 * l'applique partout (prévu, répartition, brouillon, montants fixes) et expose le résultat (`direction`)
 * au front, qui ne la recalcule jamais.
 *
 *   budget non nul : le signe du budget (négatif = sortant, positif = entrant) ;
 *   budget absent ou 0 : le signe du réel (négatif = sortant) ;
 *   ni budget ni opération : entrant.
 *
 * Centimes entiers (bigint).
 */
export type TransferDirection = 'outgoing' | 'incoming';

export function transferDirection(
  budget: bigint,
  real: bigint,
): TransferDirection {
  const sign = budget !== 0n ? budget : real;
  return sign < 0n ? 'outgoing' : 'incoming';
}

/** D'où vient le sens : le budget, à défaut le réel, à défaut le sens par défaut (entrant). Pour les logs. */
export function transferDirectionSource(
  budget: bigint,
  real: bigint,
): 'budget' | 'real' | 'default' {
  if (budget !== 0n) return 'budget';
  return real !== 0n ? 'real' : 'default';
}
