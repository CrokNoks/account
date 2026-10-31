import { describe, expect, it } from 'vitest';
import { decodeCsv, findHeaderRow, guessMapping } from './import-csv';

const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === 'string' ? [...Buffer.from(p, 'latin1')] : p)),
  ).buffer;

describe('decodeCsv', () => {
  it('decodes UTF-8 with and without BOM', () => {
    expect(decodeCsv(Uint8Array.from(Buffer.from('Libellé;Débit', 'utf-8')).buffer)).toBe(
      'Libellé;Débit',
    );
    expect(
      decodeCsv(
        Uint8Array.from(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('é')])).buffer,
      ),
    ).toBe('é');
  });

  it('decodes a Windows-1252 file', () => {
    expect(decodeCsv(bytes('Libellé;Crédit'))).toBe('Libellé;Crédit');
  });

  it('decodes a mixed file line by line: UTF-8 lines stay UTF-8, the others are Windows-1252', () => {
    const utf8Line = [...Buffer.from('01/03/2026;Électricité;-5', 'utf-8')];
    const cp1252Line = [...Buffer.from('02/03/2026;Prélèvement;-6', 'latin1')];
    const text = decodeCsv(
      bytes(utf8Line, [0x0a], cp1252Line, [0x0a], 'Date;Libellé;Montant'),
    );

    expect(text).toBe('01/03/2026;Électricité;-5\n02/03/2026;Prélèvement;-6\nDate;Libellé;Montant');
  });
});

describe('findHeaderRow', () => {
  const creditAgricole = [
    ['Compte courant'],
    ['Numéro de compte;00000000000'],
    [''],
    ['Solde au 31/10/2026', '1 234,56'],
    ['Date', 'Libellé', 'Débit euros', 'Crédit euros'],
    ['01/10/2026', 'Paiement par carte', '12,50', ''],
  ];

  it('finds the first row with a date column and a label column, accents and case ignored', () => {
    expect(findHeaderRow(creditAgricole)).toBe(4);
    expect(findHeaderRow([['DATE', 'LIBELLÉ', 'Montant'], ['x']])).toBe(0);
    expect(findHeaderRow([['x'], ['Date opération', 'Description', 'Amount']])).toBe(1);
  });

  it('falls back to the first row when none looks like a header', () => {
    expect(findHeaderRow([['a', 'b'], ['c', 'd']])).toBe(0);
    expect(findHeaderRow([])).toBe(0);
  });
});

describe('guessMapping', () => {
  it('guesses accented debit/credit and picks the debit/credit mode without an amount column', () => {
    const { mapping, amountMode } = guessMapping(['Date', 'Libellé', 'Débit euros', 'Crédit euros']);

    expect(mapping).toEqual({
      date: 'Date',
      description: 'Libellé',
      amount: '',
      debit: 'Débit euros',
      credit: 'Crédit euros',
    });
    expect(amountMode).toBe('separate');
  });

  it('keeps the single amount mode when an amount column exists', () => {
    const { mapping, amountMode } = guessMapping(['Date', 'Libellé', 'Montant', 'Débit', 'Crédit']);

    expect(mapping.amount).toBe('Montant');
    expect(amountMode).toBe('single');
  });

  it('keeps the positional fallback in single mode', () => {
    const { mapping, amountMode } = guessMapping(['a', 'b', 'c']);

    expect(mapping).toEqual({ date: 'a', description: 'b', amount: 'c', debit: '', credit: '' });
    expect(amountMode).toBe('single');
  });
});
