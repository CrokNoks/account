import { Transaction } from './transaction.entity';
import {
  ConflictError,
  DomainValidationError,
} from '../../shared/domain/errors';

/**
 * Règles pures du lien entre les deux côtés d'un virement (aucune I/O).
 * Un virement = deux transactions de comptes différents, même `metadata.transferId` :
 * `transfer_out` (montant négatif) et `transfer_in` (montant positif).
 */

type TransferType = 'transfer_out' | 'transfer_in';

const AMBIGUOUS =
  'This transfer is linked to several transactions, nothing was changed';

function typeOf(tx: Transaction): TransferType | null {
  const type: unknown = tx.metadata?.type;
  return type === 'transfer_out' || type === 'transfer_in' ? type : null;
}

/**
 * Une ligne portant `transferId` doit aussi porter un `type` valide et un
 * `relatedAccountId` : sinon le lien est invalide (409), avant tout contrôle de
 * droit ou écriture. Règle unique pour la modification et la suppression.
 */
export function assertValidLink(self: Transaction): void {
  const related: unknown = self.metadata?.relatedAccountId;
  if (
    !self.metadata?.transferId ||
    typeOf(self) === null ||
    typeof related !== 'string' ||
    related === ''
  ) {
    throw new ConflictError(AMBIGUOUS);
  }
}

/**
 * L'autre côté parmi les lignes du compte lié portant le même `transferId`.
 * Aucune → `null` (orphelin) ; une seule, de type opposé et pointant vers le
 * compte de `self` → cette ligne ; sinon 409 (on ne devine pas).
 */
export function findOtherSide(
  self: Transaction,
  candidates: Transaction[],
): Transaction | null {
  const transferId: unknown = self.metadata?.transferId;
  const selfType = typeOf(self);
  if (!transferId || !selfType) throw new ConflictError(AMBIGUOUS);

  const sameTransfer = candidates.filter(
    (c) => c.metadata?.transferId === transferId,
  );
  if (sameTransfer.length === 0) return null;
  if (sameTransfer.length > 1) throw new ConflictError(AMBIGUOUS);

  const [other] = sameTransfer;
  const expected: TransferType =
    selfType === 'transfer_out' ? 'transfer_in' : 'transfer_out';
  if (
    typeOf(other) !== expected ||
    other.metadata?.relatedAccountId !== self.accountId
  ) {
    throw new ConflictError(AMBIGUOUS);
  }
  return other;
}

/** Sortie : montant strictement négatif ; entrée : strictement positif. Jamais inversé d'office. */
export function checkTransferAmount(self: Transaction, cents: bigint): void {
  const type = typeOf(self);
  if (type === 'transfer_out' && cents >= BigInt(0)) {
    throw new DomainValidationError(
      'Transfer amount must be negative on the outgoing side',
    );
  }
  if (type === 'transfer_in' && cents <= BigInt(0)) {
    throw new DomainValidationError(
      'Transfer amount must be positive on the incoming side',
    );
  }
  if (type === null) throw new ConflictError(AMBIGUOUS);
}

const LINK_KEYS = ['transferId', 'type', 'relatedAccountId'] as const;

/**
 * Un `metadata` fourni ne doit ni changer ni retirer le lien (`transferId`,
 * `type`, `relatedAccountId`). Une transaction qui n'est pas un virement n'est pas contrôlée.
 */
export function checkMetadataKeepsLink(
  existing: Record<string, unknown> | undefined,
  provided: Record<string, unknown> | undefined,
): void {
  if (!existing?.transferId) return;
  for (const key of LINK_KEYS) {
    if (provided?.[key] !== existing[key]) {
      throw new DomainValidationError('The transfer link cannot be changed');
    }
  }
}

/**
 * L'autre côté à écrire : montant opposé et date du côté modifié. Tout le reste
 * (pointage, pending, catégorie, notes, libellé, tags, période) est conservé.
 */
export function planTransferUpdate(
  other: Transaction,
  modified: Transaction,
): Transaction {
  return new Transaction({
    ...other,
    amount: -modified.amount,
    date: modified.date,
    updatedAt: new Date(),
  });
}
