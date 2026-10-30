export function formatCurrency(amountCents: string | number): string {
  const amount = typeof amountCents === 'string' ? parseInt(amountCents, 10) : amountCents;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount / 100);
}

const CURRENCY_WORDS = /(?<!\p{L})(?:eur|euros?|usd|gbp|chf|cad|jpy|aud)(?!\p{L})/giu;

/**
 * Parses a user-typed amount into integer cents, without floating point.
 * - spaces (including U+00A0 / U+202F), currency symbols (€ $ £ ...) and usual currency
 *   codes/words (EUR, USD, GBP, CHF, CAD, JPY, AUD, euro(s), any case) are ignored;
 * - any other letter makes the input unreadable ("12abc", "1e5" -> null);
 * - a leading or trailing "-" makes the amount negative;
 * - if both "." and "," appear, the LAST one is the decimal separator and the other
 *   one a thousands separator;
 * - a single separator type repeated ("1.234.567") is a thousands separator;
 * - a single separator appearing once ("10,50", "1.234") is the decimal separator;
 * - more than 2 decimals are rounded half-up on the string (1.005 -> 101).
 * Returns null when the input holds no valid amount.
 */
export function parseAmountToCents(input: string): bigint | null {
  const withoutCurrency = input.replace(CURRENCY_WORDS, ' ');
  if (/\p{L}/u.test(withoutCurrency)) return null;
  const kept = withoutCurrency.replace(/\u2212/g, '-').replace(/[^\d.,-]/g, '');
  const negative = kept.startsWith('-') || kept.endsWith('-');
  const body = kept.replace(/^-/, '').replace(/-$/, '');
  if (!/\d/.test(body) || /[^\d.,]/.test(body)) return null;

  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');
  const dots = body.split('.').length - 1;
  const commas = body.split(',').length - 1;

  let decimalIdx = -1;
  if (dots > 0 && commas > 0) {
    decimalIdx = Math.max(lastDot, lastComma);
    const thousandsChar = decimalIdx === lastDot ? ',' : '.';
    const decimalChar = body[decimalIdx];
    if (body.split(decimalChar).length - 1 > 1) return null;
    if (body.slice(decimalIdx).includes(thousandsChar)) return null;
  } else if (dots === 1 || commas === 1) {
    decimalIdx = Math.max(lastDot, lastComma);
  }

  const intRaw = decimalIdx >= 0 ? body.slice(0, decimalIdx) : body;
  const fracRaw = decimalIdx >= 0 ? body.slice(decimalIdx + 1) : '';
  const intPart = intRaw.replace(/[.,]/g, '') || '0';
  const frac = fracRaw.padEnd(3, '0');

  let cents = BigInt(intPart) * BigInt(100) + BigInt(frac.slice(0, 2));
  if (frac.charCodeAt(2) >= 53) cents += BigInt(1); // third decimal >= 5 rounds up
  return negative ? -cents : cents;
}

/**
 * Formats integer cents as a plain decimal string (e.g. -123456n -> "-1234.56").
 */
export function centsToDecimalString(cents: bigint): string {
  const negative = cents < BigInt(0);
  const abs = negative ? -cents : cents;
  const whole = abs / BigInt(100);
  const frac = (abs % BigInt(100)).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/**
 * True when the input is non-empty but holds no readable amount (so toCents would
 * silently turn it into "0"). Empty input is NOT unreadable: each form decides
 * whether an empty field is required or means 0.
 */
export function isUnreadableAmount(input: string): boolean {
  return input.trim() !== '' && parseAmountToCents(input) === null;
}

/**
 * Cents of a filter input, or undefined when it is empty or unreadable
 * (no filter instead of a filter on 0).
 */
export function toOptionalCents(input: string): string | undefined {
  const cents = parseAmountToCents(input);
  return cents === null ? undefined : cents.toString();
}

/**
 * Converts a string amount (e.g. "10.50", "1 234,56") to cents (e.g. "1050").
 * Invalid input returns "0".
 */
export function toCents(amount: string): string {
  const cents = parseAmountToCents(amount);
  return cents === null ? '0' : cents.toString();
}

/**
 * Converts a string amount to absolute cents. Invalid input returns "0".
 */
export function toAbsCents(amount: string): string {
  const cents = parseAmountToCents(amount);
  if (cents === null) return '0';
  return (cents < BigInt(0) ? -cents : cents).toString();
}

/**
 * Converts cents (string or number) to a string amount (e.g. "10.50").
 */
export function fromCents(amountCents: string | number): string {
  const amount = typeof amountCents === 'string' ? parseInt(amountCents, 10) : amountCents;
  if (isNaN(amount)) return '0';
  return (amount / 100).toString();
}
