import { describe, expect, it } from 'vitest';
import { formatCurrency, fromCents, isUnreadableAmount, toAbsCents, toCents, toOptionalCents } from './format';

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

describe('fromCents', () => {
  it.each([
    ['1050', '10.5'],
    [1050, '10.5'],
    ['-4250', '-42.5'],
    ['1999', '19.99'],
    ['100', '1'],
    ['abc', '0'],
  ])('converts %j cents to %s', (cents, expected) => {
    expect(fromCents(cents)).toBe(expected);
  });

  it('round-trips with toCents', () => {
    for (const cents of ['0', '7', '1050', '-4250', '123456']) {
      expect(toCents(fromCents(cents))).toBe(cents);
    }
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
  });
});
