import { ImportMapping } from './import-types';

const strict = (label: string) => new TextDecoder(label, { fatal: true });

// UTF-8 (BOM removed by the decoder) first; Windows-1252 (French bank exports) if the bytes are not valid UTF-8.
// A file mixing both is decoded line by line: a line is UTF-8 if it is valid UTF-8, Windows-1252 otherwise.
export function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return strict('utf-8').decode(buffer);
  } catch {
    const legacy = new TextDecoder('windows-1252');
    const bytes = new Uint8Array(buffer);
    const lines: string[] = [];
    let start = 0;
    for (let i = 0; i <= bytes.length; i++) {
      if (i < bytes.length && bytes[i] !== 0x0a) continue;
      const line = bytes.subarray(start, i);
      try {
        lines.push(strict('utf-8').decode(line));
      } catch {
        lines.push(legacy.decode(line));
      }
      start = i + 1;
    }
    return lines.join('\n');
  }
}

/** Lowercase, accents removed: « Libellé » and « LIBELLE » are the same header. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const DATE = /date/;
const DESCRIPTION = /libelle|description|label/;
const AMOUNT = /montant|amount/;
const DEBIT = /debit/;
const CREDIT = /credit/;

const findCell = (cells: string[], pattern: RegExp) => cells.find((c) => pattern.test(fold(c)));

/** Index of the first row with a date column and a label column; 0 when none. */
export function findHeaderRow(rows: string[][]): number {
  const index = rows.findIndex(
    (row) => findCell(row, DATE) !== undefined && findCell(row, DESCRIPTION) !== undefined,
  );
  return index === -1 ? 0 : index;
}

export function guessMapping(headers: string[]): {
  mapping: ImportMapping;
  amountMode: 'single' | 'separate';
} {
  const debit = findCell(headers, DEBIT) ?? '';
  const credit = findCell(headers, CREDIT) ?? '';
  const amount = findCell(headers, AMOUNT);
  const separate = debit !== '' && credit !== '' && amount === undefined;

  return {
    mapping: {
      date: findCell(headers, DATE) || headers[0] || '',
      description: findCell(headers, DESCRIPTION) || headers[1] || '',
      amount: amount ?? (separate ? '' : headers[2] || ''),
      debit,
      credit,
    },
    amountMode: separate ? 'separate' : 'single',
  };
}
