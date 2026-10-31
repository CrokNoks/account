/**
 * Montants en centimes entiers, transmis en chaîne : jamais de passage par un
 * flottant (`Number` perd la précision au-delà de 2^53 et arrondit les décimales).
 */

const INT64_MIN = -(BigInt(2) ** BigInt(63));
const INT64_MAX = BigInt(2) ** BigInt(63) - BigInt(1);

/** Entier décimal signé (`-0` accepté, lu comme 0), tenant dans un bigint SQL signé 64 bits. */
export function isCentsString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return false;
  const cents = BigInt(value);
  return cents >= INT64_MIN && cents <= INT64_MAX;
}

/** Convertit un montant déjà validé par `isCentsString`. */
export function parseCents(value: string): bigint {
  if (!isCentsString(value)) {
    throw new Error(`Invalid amount in cents: ${String(value)}`);
  }
  return BigInt(value);
}
