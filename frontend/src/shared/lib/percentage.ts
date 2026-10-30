/**
 * Pulse percentage of the monthly widget: round(((B + A) * -100) / A),
 * rounded half away from zero. The division is done on BigInt with the
 * rounding applied BEFORE converting to a number (a plain BigInt division
 * truncates toward zero). Returns 0 when A is 0.
 */
export function expensePulsePercentage(totalA: bigint, totalB: bigint): number {
  const zero = BigInt(0);
  if (totalA === zero) return 0;
  const num = (totalB + totalA) * BigInt(-100);
  const negative = (num < zero) !== (totalA < zero) && num !== zero;
  const absNum = num < zero ? -num : num;
  const absDen = totalA < zero ? -totalA : totalA;
  const q = (absNum * BigInt(2) + absDen) / (absDen * BigInt(2));
  return Number(negative ? -q : q);
}
