import { describe, expect, it } from 'vitest';
import { formatSignedAmount } from './signed-amount';

const norm = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatSignedAmount', () => {
  it('écrit toujours le signe, depuis des centimes entiers', () => {
    expect(norm(formatSignedAmount('-80000'))).toBe('-800,00 €');
    expect(norm(formatSignedAmount('320000'))).toBe('+3 200,00 €');
    expect(norm(formatSignedAmount(BigInt(-1234)))).toBe('-12,34 €');
  });

  it('ne met pas de signe sur zéro', () => {
    expect(norm(formatSignedAmount('0'))).toBe('0,00 €');
  });
});
