import { describe, expect, it } from 'vitest';
import { formatCurrency, fromCents, toAbsCents, toCents } from './format';

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

  // Comportement actuel : les séparateurs de milliers ne sont pas gérés,
  // parseFloat s'arrête au premier caractère inattendu.
  describe('thousands separators (current behaviour)', () => {
    it.each([
      ['1 234,56', '100'],
      ['1.234,56', '123'],
      ['12,345.67', '1235'],
    ])('converts %j to %s cents', (amount, expected) => {
      expect(toCents(amount)).toBe(expected);
    });
  });

  // Comportement actuel : arrondi flottant (1.005 * 100 = 100.4999…).
  it('rounds 1.005 down to 100 cents', () => {
    expect(toCents('1.005')).toBe('100');
  });
});

describe('toAbsCents', () => {
  it.each([
    ['-42,50', '4250'],
    ['42.5', '4250'],
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
