import { describe, expect, it } from 'vitest';
import { formatCurrency, splitAmount, parseAmountToCents, isUnreadableAmount, toAbsCents, toCents, toOptionalCents, centsToInputString } from './format';

// Intl insère des espaces insécables : on les normalise pour comparer.
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatCurrency', () => {
  it.each([
    ['150000', '1 500,00 €'],
    [150000, '1 500,00 €'],
    ['-4250', '-42,50 €'],
    ['5', '0,05 €'],
    ['0', '0,00 €'],
  ])('formats %j cents as %s', (cents, expected) => {
    expect(plain(formatCurrency(cents))).toBe(expected);
  });

  // Comportement actuel : une valeur non numérique n'est pas protégée.
  it('formats a non numeric string as NaN', () => {
    expect(plain(formatCurrency('abc'))).toBe('NaN €');
  });
});

// Texte exact (espaces insécables compris) : N = U+202F (milliers), E = U+00A0 (avant le symbole).
const N = ' ';
const E = ' ';

describe('formatCurrency, texte exact', () => {
  it.each([
    ['0', `0,00${E}€`],
    ['1', `0,01${E}€`],
    ['5', `0,05${E}€`],
    ['99', `0,99${E}€`],
    ['100', `1,00${E}€`],
    ['-1', `-0,01${E}€`],
    ['-99', `-0,99${E}€`],
    ['-0', `-0,00${E}€`],
    ['12345', `123,45${E}€`],
    ['-12345', `-123,45${E}€`],
    ['100000', `1${N}000,00${E}€`],
    ['-123456', `-1${N}234,56${E}€`],
    ['123456789', `1${N}234${N}567,89${E}€`],
    ['-123456789', `-1${N}234${N}567,89${E}€`],
    ['123456789012', `1${N}234${N}567${N}890,12${E}€`],
    ['900719925474099', `9${N}007${N}199${N}254${N}740,99${E}€`],
    [150000, `1${N}500,00${E}€`],
    [-4250, `-42,50${E}€`],
    [0, `0,00${E}€`],
    [-0, `-0,00${E}€`],
  ])('formats %j cents as the exact text', (cents, expected) => {
    expect(formatCurrency(cents)).toBe(expected);
  });

  it('keeps reading a decimal or non numeric string like before', () => {
    expect(formatCurrency('12.5')).toBe(`0,12${E}€`);
    expect(formatCurrency('abc')).toBe(`NaN${E}€`);
    expect(formatCurrency(NaN)).toBe(`NaN${E}€`);
  });
});

describe('formatCurrency, au-delà de 2^53', () => {
  it.each([
    ['9007199254740991', `90${N}071${N}992${N}547${N}409,91${E}€`],
    ['9007199254740993', `90${N}071${N}992${N}547${N}409,93${E}€`],
    ['-9007199254740993', `-90${N}071${N}992${N}547${N}409,93${E}€`],
    ['12345678901234567890', `123${N}456${N}789${N}012${N}345${N}678,90${E}€`],
  ])('formats %s cents without losing a cent', (cents, expected) => {
    expect(formatCurrency(cents)).toBe(expected);
  });

  it('accepts a bigint', () => {
    expect(formatCurrency(BigInt('9007199254740993'))).toBe(`90${N}071${N}992${N}547${N}409,93${E}€`);
  });
});

describe('toCents', () => {
  it.each([
    ['10.50', '1050'],
    ['10,50', '1050'],
    ['10,5', '1050'],
    ['-42,5', '-4250'],
    ['42', '4200'],
    ['0.1', '10'],
    ['0,07', '7'],
    ['19.99', '1999'],
    ['  12.30  ', '1230'],
    ['12.30 €', '1230'],
  ])('converts %j to %s cents', (amount, expected) => {
    expect(toCents(amount)).toBe(expected);
  });

  it.each(['', 'abc', '€'])('returns "0" for %j', (amount) => {
    expect(toCents(amount)).toBe('0');
  });

  describe('thousands separators', () => {
    it.each([
      ['1 234,56', '123456'],
      ['1\u00a0234,56', '123456'],
      ['1\u202f234,56', '123456'],
      ['1.234,56', '123456'],
      ['12,345.67', '1234567'],
      ['1.234.567', '123456700'],
      ['1,234,567', '123456700'],
      ['-1.234,56', '-123456'],
      ['42,50-', '-4250'],
      ['€ 1 234,56', '123456'],
      ['1234,56 EUR', '123456'],
      ['10.50', '1050'],
      ['10,50', '1050'],
      ['.5', '50'],
      ['1.2,3,4', '0'],
      ['1-2', '0'],
    ])('converts %j to %s cents', (amount, expected) => {
      expect(toCents(amount)).toBe(expected);
    });
  });

  it.each(['12abc', '1e5', '1e-5', '12 foo', 'x12', '1,5k'])('refuses %j (letters that are not a currency)', (amount) => {
    expect(parseAmountToCents(amount)).toBeNull();
    expect(toCents(amount)).toBe('0');
    expect(isUnreadableAmount(amount)).toBe(true);
  });

  it.each([
    ['12 EUR', BigInt(1200)],
    ['12 eur', BigInt(1200)],
    ['EUR 12,50', BigInt(1250)],
    ['12,50 euros', BigInt(1250)],
    ['$12.50', BigInt(1250)],
    ['£ 1,234.50', BigInt(123450)],
    ['-12 USD', BigInt(-1200)],
    ['12.50CHF', BigInt(1250)],
  ])('keeps reading %j (currency symbol or code)', (amount, expected) => {
    expect(parseAmountToCents(amount)).toBe(expected);
  });

  it('rounds half-up on the string, without floating point', () => {
    expect(toCents('1.005')).toBe('101');
    expect(toCents('1.004')).toBe('100');
    expect(toCents('0,015')).toBe('2');
    expect(toCents('-1,005')).toBe('-101');
  });
});

describe('toAbsCents', () => {
  it.each([
    ['-42,50', '4250'],
    ['42.5', '4250'],
    ['-1.234,56', '123456'],
    ['abc', '0'],
  ])('converts %j to %s cents', (amount, expected) => {
    expect(toAbsCents(amount)).toBe(expected);
  });
});

describe('isUnreadableAmount / toOptionalCents', () => {
  it('flags non-empty unreadable input only', () => {
    expect(isUnreadableAmount('abc')).toBe(true);
    expect(isUnreadableAmount('1e-5')).toBe(true);
    expect(isUnreadableAmount('')).toBe(false);
    expect(isUnreadableAmount('  ')).toBe(false);
    expect(isUnreadableAmount('12,50')).toBe(false);
    expect(isUnreadableAmount('0')).toBe(false);
  });
  it('gives undefined for empty or unreadable input, cents otherwise', () => {
    expect(toOptionalCents('')).toBeUndefined();
    expect(toOptionalCents('abc')).toBeUndefined();
    expect(toOptionalCents('0')).toBe('0');
    expect(toOptionalCents('10,5')).toBe('1050');
    expect(toOptionalCents('-10,5')).toBe('-1050');
  });
});

describe('splitAmount', () => {
  it('returns sign, integer digits and the raw decimal digits (no rounding)', () => {
    expect(splitAmount('-1.234,567')).toEqual({ negative: true, intRaw: '1.234', intPart: '1234', fracRaw: '567' });
    expect(splitAmount('1.234.567')).toEqual({ negative: false, intRaw: '1.234.567', intPart: '1234567', fracRaw: '' });
    expect(splitAmount('12,5')).toEqual({ negative: false, intRaw: '12', intPart: '12', fracRaw: '5' });
    expect(splitAmount(',5')).toEqual({ negative: false, intRaw: '', intPart: '0', fracRaw: '5' });
  });

  it('returns null for unreadable input', () => {
    expect(splitAmount('abc')).toBeNull();
    expect(splitAmount('1e5')).toBeNull();
    expect(splitAmount('')).toBeNull();
  });
});

describe('centsToInputString', () => {
  it.each([
    [BigInt(320000), 'fr', '3200,00'],
    [BigInt(320000), 'en', '3200.00'],
    [BigInt(-18050), 'fr', '-180,50'],
    [BigInt(5), 'en', '0.05'],
  ])('%s in %s -> %s, read back to the same cents', (cents, locale, text) => {
    expect(centsToInputString(cents, locale)).toBe(text);
    expect(parseAmountToCents(text)).toBe(cents);
  });
});

describe('centsToInputString round trip', () => {
  it.each(['fr', 'en'])('gives back the exact cents in %s, very large amounts included', (locale) => {
    const samples = [
      '0', '5', '50', '100', '320050', '-320050', '-5',
      '9007199254740993', // 2^53 + 1: a float cannot hold it
      '-9007199254740993',
      '123456789012345678901234567890',
    ].map((c) => BigInt(c));
    for (const cents of samples) {
      expect(parseAmountToCents(centsToInputString(cents, locale))).toBe(cents);
    }
  });

  it('keeps two decimals and the language separator, no float artefact', () => {
    expect(centsToInputString(BigInt('320050'), 'fr')).toBe('3200,50');
    expect(centsToInputString(BigInt('9007199254740993'), 'en')).toBe('90071992547409.93');
  });
});
