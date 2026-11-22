/**
 * Règle unique d'une ligne de dépense (ou d'épargne) dont le réel net est positif : un remboursement.
 * Rien n'est consommé : c'est un excédent, jamais un dépassement ni une part du budget (centimes, bigint).
 */
export const isSurplus = (real: bigint): boolean => real > BigInt(0);

/** Montant consommé d'une ligne de dépense : |réel| si négatif, 0 pour un excédent. */
export const spentAmount = (real: bigint): bigint => (real < BigInt(0) ? -real : BigInt(0));
