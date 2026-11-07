import { splitAmount } from '@/shared/lib/format';

export type EntryDirection = 'expense' | 'income' | 'transfer';

export type EntryAmount =
  | { status: 'ok'; cents: string }
  | { status: 'empty' | 'zero' | 'unreadable' | 'too_many_decimals' | 'too_large' };

/** 9 999 999 999,99 EUR, en centimes. */
export const MAX_ENTRY_CENTS = BigInt('999999999999');

/**
 * Mobile entry: the direction (not a typed "-") fixes the sign, the absolute value of the
 * text fixes the amount. A zero amount is refused. More than 2 decimals is refused, never rounded.
 * Integer cents as a string, no floating point.
 */
export function toEntryCents(input: string, direction: EntryDirection): EntryAmount {
  if (input.trim() === '') return { status: 'empty' };
  const parts = splitAmount(input);
  if (parts === null) return { status: 'unreadable' };
  // Repeated separators must be thousands groups ("1.234.567"), not "1,2,3,4,5".
  if (/[.,]/.test(parts.intRaw) && !/^\d{1,3}([.,]\d{3})+$/.test(parts.intRaw)) return { status: 'unreadable' };
  if (parts.fracRaw.length > 2) return { status: 'too_many_decimals' };

  const abs = BigInt(parts.intPart) * BigInt(100) + BigInt(parts.fracRaw.padEnd(2, '0'));
  if (abs > MAX_ENTRY_CENTS) return { status: 'too_large' };
  if (abs === BigInt(0)) return { status: 'zero' };
  return { status: 'ok', cents: (direction === 'expense' ? -abs : abs).toString() };
}
