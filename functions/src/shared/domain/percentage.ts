/**
 * Percentage numerator/denominator * 100, rounded half away from zero to
 * `decimals` decimals. Computed entirely in BigInt (no float precision loss on
 * large amounts). Returns 0 when the denominator is 0.
 */
export function roundedPercentage(
  numerator: bigint,
  denominator: bigint,
  decimals = 0,
): number {
  if (denominator === BigInt(0)) return 0;
  const negative = numerator < BigInt(0) !== denominator < BigInt(0);
  const absNum = numerator < BigInt(0) ? -numerator : numerator;
  const absDen = denominator < BigInt(0) ? -denominator : denominator;
  const scale = BigInt(10) ** BigInt(decimals);
  const rounded =
    (absNum * BigInt(100) * scale * BigInt(2) + absDen) / (absDen * BigInt(2));
  if (rounded === BigInt(0)) return 0;
  const value = Number(rounded) / Number(scale);
  return negative ? -value : value;
}
