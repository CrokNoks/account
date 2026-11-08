const EUR_BY_LOCALE = new Map<string, Intl.NumberFormat>();
function eurFormat(locale: string): Intl.NumberFormat {
  let format = EUR_BY_LOCALE.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : locale, { style: 'currency', currency: 'EUR' });
    EUR_BY_LOCALE.set(locale, format);
  }
  return format;
}

/**
 * Integer cents as a euro amount, without floating point: the cents are cut into a decimal
 * string ("-123456" -> "-1234.56") that Intl formats exactly, so it stays exact beyond 2^53.
 * The text follows the language ("1 500,00 €" in fr, "€1,500.00" in en), French by default.
 * Reading is unchanged: a string is read like parseInt (leading integer), anything unreadable gives "NaN €".
 */
export function formatCurrency(amountCents: string | number | bigint, locale = 'fr'): string {
  const EUR = eurFormat(locale);
  let digits: string;
  let negative: boolean;
  if (typeof amountCents === 'bigint') {
    negative = amountCents < BigInt(0);
    digits = (negative ? -amountCents : amountCents).toString();
  } else if (typeof amountCents === 'number') {
    if (!Number.isInteger(amountCents)) return EUR.format(amountCents / 100);
    negative = amountCents < 0 || Object.is(amountCents, -0);
    digits = BigInt(Math.abs(amountCents)).toString();
  } else {
    const match = /^\s*([+-]?)(\d+)/.exec(amountCents);
    if (!match) return EUR.format(NaN);
    negative = match[1] === '-';
    digits = match[2].replace(/^0+(?=\d)/, '');
  }
  const padded = digits.padStart(3, '0');
  const decimal = `${negative ? '-' : ''}${padded.slice(0, -2)}.${padded.slice(-2)}` as `${number}`;
  return EUR.format(decimal);
}

/**
 * A percentage (12.5 means 12.5 %) in the language's format, at most 2 decimals ("6,68 %" in fr, "6.68%" in en).
 * `signed` writes the sign of a change ("+26,17 %"), nothing for zero. Display only: the value is already a ratio, not money.
 */
export function formatPercent(value: number, locale: string, options: { signed?: boolean } = {}): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 2,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  }).format(value / 100);
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
  const parts = splitAmount(input);
  if (parts === null) return null;
  const frac = parts.fracRaw.padEnd(3, '0');

  let cents = BigInt(parts.intPart) * BigInt(100) + BigInt(frac.slice(0, 2));
  if (frac.charCodeAt(2) >= 53) cents += BigInt(1); // third decimal >= 5 rounds up
  return parts.negative ? -cents : cents;
}

/**
 * Reading step shared by parseAmountToCents and the mobile entry (entry-amount.ts):
 * sign, integer part as typed (intRaw) and without thousands separators (intPart), and RAW decimal digits, no rounding.
 * Null when the input holds no valid amount.
 */
export function splitAmount(input: string): { negative: boolean; intRaw: string; intPart: string; fracRaw: string } | null {
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
  return { negative, intRaw, intPart, fracRaw };
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
 * Integer cents as the text of an input field in the language's decimal separator, no thousands
 * separator, always 2 decimals (-123456n, "fr" -> "-1234,56"; "en" -> "-1234.56"). Pure string work, no float.
 * parseAmountToCents reads it back.
 */
export function centsToInputString(cents: bigint, locale: string): string {
  const separator =
    new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';
  return centsToDecimalString(cents).replace('.', separator);
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
