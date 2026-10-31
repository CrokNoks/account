/**
 * Montants en centimes entiers, transmis en chaîne : jamais de passage par un
 * flottant (`Number` perd la précision au-delà de 2^53 et arrondit les décimales).
 *
 * Borne ±(2^53 − 1) : PostgREST renvoie les bigint en nombre JSON, donc tout
 * montant plus grand serait relu faussé. En deçà, lecture et écriture sont exactes.
 */

const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_CENTS = -MAX_CENTS;

/** Entier décimal signé (`-0` accepté, lu comme 0), dans ±(2^53 − 1). */
export function isCentsString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return false;
  const cents = BigInt(value);
  return cents >= MIN_CENTS && cents <= MAX_CENTS;
}

/** Convertit un montant déjà validé par `isCentsString`. */
export function parseCents(value: string): bigint {
  if (!isCentsString(value)) {
    throw new Error(`Invalid amount in cents: ${String(value)}`);
  }
  return BigInt(value);
}
