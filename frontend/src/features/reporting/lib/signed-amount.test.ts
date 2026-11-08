import { describe, expect, it } from 'vitest';
import { formatSignedAmount, presentAmount } from './signed-amount';

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

describe('presentAmount', () => {
  const cases: Array<[string, string, string, string]> = [
    // [centimes, texte fr d'un solde, texte fr d'un flux, texte en d'un solde]
    ['320000', '3 200,00 €', '+3 200,00 €', '€3,200.00'],
    ['-80000', '-800,00 €', '-800,00 €', '-€800.00'],
    ['0', '0,00 €', '0,00 €', '€0.00'],
    ['123456789012345678', '1 234 567 890 123 456,78 €', '+1 234 567 890 123 456,78 €', '€1,234,567,890,123,456.78'],
  ];

  it.each(cases)('%s : mêmes chiffres qu\'avant, signe écrit pour un flux', (cents, balanceFr, flowFr, balanceEn) => {
    expect(norm(presentAmount(cents, 'balance', 'fr').text)).toBe(balanceFr);
    expect(norm(presentAmount(cents, 'flow', 'fr').text)).toBe(flowFr);
    expect(norm(presentAmount(cents, 'balance', 'en').text)).toBe(balanceEn);
  });

  it('un solde négatif est orange, jamais rouge ; sinon encre', () => {
    expect(presentAmount('-80000', 'balance', 'fr').tone).toBe('warn');
    expect(presentAmount('320000', 'balance', 'fr').tone).toBe('ink');
    expect(presentAmount('0', 'balance', 'en').tone).toBe('ink');
  });

  it('un flux (opération, échéance) est toujours en encre : une dépense normale n\'est pas une alerte', () => {
    expect(presentAmount('-80000', 'flow', 'fr').tone).toBe('ink');
    expect(presentAmount('320000', 'flow', 'en').tone).toBe('ink');
  });

  it('la teinte ne porte jamais seule le sens : un montant négatif garde son signe', () => {
    for (const locale of ['fr', 'en']) {
      expect(presentAmount('-1', 'balance', locale).text).toContain('-');
      expect(presentAmount('-1', 'flow', locale).text).toContain('-');
    }
  });
});
