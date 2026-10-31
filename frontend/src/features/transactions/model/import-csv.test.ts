import { describe, expect, it } from 'vitest';
import { decodeCsv } from './import-csv';

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
