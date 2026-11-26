import { DomainValidationError } from '../../shared/domain/errors';

/**
 * Règle unique : une transaction n'est jamais à la fois pointée (`reconciled`) et
 * `pending` (spec soldes-et-prevu-justes, CA9). Les lectures et les calculs
 * s'appuient sur elle (En banque ⊂ À venir). Gardée à chaque écriture, et par une
 * contrainte CHECK en base.
 */
export function assertNotReconciledAndPending(
  reconciled: boolean | undefined,
  pending: boolean | undefined,
): void {
  if (reconciled === true && pending === true) {
    throw new DomainValidationError(
      'A reconciled transaction cannot be pending',
    );
  }
}

/**
 * État « en attente » à la modification (simple ou en lot) :
 *  - pointer (`reconciled: true`) sort de l'attente (`pending` devient faux) ;
 *  - `reconciled: true` ET `pending: true` dans le même corps : refusé ;
 *  - `pending: true` sur une transaction déjà pointée, sans la dépointer dans
 *    le même corps : refusé ;
 *  - sinon `pending` fourni est appliqué, à défaut l'état existant est conservé.
 */
export function resolvePending(
  reconciled: boolean | undefined,
  pending: boolean | undefined,
  existingPending: boolean,
  existingReconciled: boolean,
): boolean {
  assertNotReconciledAndPending(reconciled, pending);
  const finalReconciled = reconciled ?? existingReconciled;
  assertNotReconciledAndPending(finalReconciled, pending);
  if (reconciled === true) return false;
  return pending ?? existingPending;
}

/** Vrai pour la seule transition `pending` → non `pending` (pointer, décocher, lot). */
export function isLeavingPending(before: boolean, after: boolean): boolean {
  return before && !after;
}
