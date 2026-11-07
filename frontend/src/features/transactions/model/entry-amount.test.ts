import { describe, expect, it } from 'vitest';
import { toEntryCents } from './entry-amount';

const ok = (cents: string) => ({ status: 'ok', cents });

describe('toEntryCents : le sens fixe le signe, la saisie fixe la valeur absolue', () => {
  it.each([
    ['12,50', 'expense', '-1250'],
    ['12,50', 'income', '1250'],
    ['12.50', 'expense', '-1250'],
    ['1 234,56', 'expense', '-123456'],
    ['1 234,56', 'expense', '-123456'],
    ['1.234,56', 'expense', '-123456'],
    ['1,234.56', 'expense', '-123456'],
    ['1.234.567', 'expense', '-123456700'],
    ['12,50 €', 'expense', '-1250'],
    ['€12,50', 'expense', '-1250'],
    ['12,50 EUR', 'expense', '-1250'],
    ['0,5', 'expense', '-50'],
    ['0,05', 'expense', '-5'],
    ['12', 'expense', '-1200'],
    [',5', 'expense', '-50'],
    ['-12,50', 'expense', '-1250'],
    ['12,50-', 'expense', '-1250'],
    ['−12,50', 'expense', '-1250'],
    ['-12,50', 'income', '1250'],
    ['12,50', 'transfer', '1250'],
    ['-12,50', 'transfer', '1250'],
    ['9999999999,99', 'expense', '-999999999999'],
  ] as const)('%j (%s) -> %s', (input, direction, cents) => {
    expect(toEntryCents(input, direction)).toEqual(ok(cents));
  });

  it.each(['1,005', '1.005', '12,999', '1,230'])('%j : plus de 2 décimales, refusé (jamais arrondi)', (input) => {
    expect(toEntryCents(input, 'expense')).toEqual({ status: 'too_many_decimals' });
  });

  it.each([['0','expense'],['-0','expense'],['0','income'],['0,00','transfer'],['0.0','expense']] as const)('%j (%s) : zéro, refusé', (input, direction) => {
    expect(toEntryCents(input, direction)).toEqual({ status: 'zero' });
  });

  it.each(['', '   '])('%j : vide', (input) => {
    expect(toEntryCents(input, 'expense')).toEqual({ status: 'empty' });
  });

  it.each(['abc', '12abc', '1e5', '--', '12-3', ',', '1,2,3,4,5'])('%j : illisible', (input) => {
    expect(toEntryCents(input, 'expense')).toEqual({ status: 'unreadable' });
  });

  it.each(['10000000000', '99999999999999999999', '10000000000,00'])('%j : au-dessus du plafond', (input) => {
    expect(toEntryCents(input, 'expense')).toEqual({ status: 'too_large' });
  });
});
