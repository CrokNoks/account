import { describe, expect, it } from 'vitest';
import {
  comparableLabel,
  dayNumber,
  markImportRows,
  windowForRows,
  type ExistingTransaction,
  type ImportRowToCompare,
} from './import-duplicates';

const row = (id: string, date: string, description: string, amount: string, invalid = false): ImportRowToCompare => ({
  id,
  date,
  description,
  amount,
  invalid,
});
const tx = (id: string, date: string, description: string, amount: string, pending = false): ExistingTransaction => ({
  id,
  date,
  description,
  amount,
  pending,
});

const excludedIds = (marks: ReturnType<typeof markImportRows>) =>
  Object.entries(marks)
    .filter(([, m]) => m.duplicateOf)
    .map(([id]) => id);

describe('comparableLabel', () => {
  it('réduit les espaces, passe en minuscules et retire les accents, rien d autre', () => {
    expect(comparableLabel('  CB  Café Paul ')).toBe('cb cafe paul');
    expect(comparableLabel('CB CAFE PAUL 12/11')).not.toBe(comparableLabel('CB CAFE PAUL'));
  });
});

describe('dayNumber', () => {
  it('compte des jours calendaires sans fuseau, y compris autour du changement d heure', () => {
    expect(dayNumber('2026-03-29') - dayNumber('2026-03-28')).toBe(1);
    expect(dayNumber('2026-10-25') - dayNumber('2026-10-24')).toBe(1);
    expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1);
    expect(dayNumber('2026-03-01T00:00:00.000Z')).toBe(dayNumber('2026-03-01'));
  });
});

describe('markImportRows : décompte des occurrences (règle critique)', () => {
  const cafe = (id: string) => row(id, '2026-11-10', 'Café', '-250');
  const baseCafe = (id: string) => tx(id, '2026-11-10', 'café', '-250');

  it('2 lignes au relevé, 1 en base : une seule décochée, la première du fichier', () => {
    const marks = markImportRows([cafe('a'), cafe('b')], [baseCafe('t1')]);
    expect(excludedIds(marks)).toEqual(['a']);
  });

  it('2 au relevé, 2 en base : les deux décochées', () => {
    const marks = markImportRows([cafe('a'), cafe('b')], [baseCafe('t1'), baseCafe('t2')]);
    expect(excludedIds(marks)).toEqual(['a', 'b']);
  });

  it('1 au relevé, 2 en base : elle est décochée', () => {
    expect(excludedIds(markImportRows([cafe('a')], [baseCafe('t1'), baseCafe('t2')]))).toEqual(['a']);
  });

  it('2 au relevé, 0 en base : rien n est décoché', () => {
    expect(markImportRows([cafe('a'), cafe('b')], [])).toEqual({});
  });

  it('renvoie la transaction trouvée (date, libellé)', () => {
    const marks = markImportRows([cafe('a')], [tx('t1', '2026-11-10T00:00:00.000Z', 'CAFÉ', '-250')]);
    expect(marks.a.duplicateOf).toEqual({ date: '2026-11-10T00:00:00.000Z', description: 'CAFÉ' });
  });

  it('ignore les pending de la base', () => {
    expect(markImportRows([cafe('a')], [tx('t1', '2026-11-10', 'Café', '-250', true)])).toEqual({});
  });

  it('exige la même date, le même montant et le même libellé comparé', () => {
    const base = [
      tx('t1', '2026-11-11', 'Café', '-250'),
      tx('t2', '2026-11-10', 'Café', '-251'),
      tx('t3', '2026-11-10', 'Café Paul', '-250'),
    ];
    expect(excludedIds(markImportRows([cafe('a')], base))).toEqual([]);
  });

  it('ne compare jamais une ligne illisible, et elle ne consomme rien', () => {
    const marks = markImportRows([row('bad', '2026-11-10', 'Café', '', true), cafe('a')], [baseCafe('t1')]);
    expect(marks.bad).toBeUndefined();
    expect(excludedIds(marks)).toEqual(['a']);
  });

  it('ne lit que les transactions données : sans base (autre compte), rien n est marqué', () => {
    expect(markImportRows([cafe('a')], [])).toEqual({});
  });
});

describe('markImportRows : lignes proches', () => {
  const manual = tx('t1', '2026-11-25', 'Boulangerie', '-850');

  it('signale sans décocher : même montant, 1 jour d écart, autre libellé', () => {
    const marks = markImportRows([row('a', '2026-11-26', 'CB BOULANGERIE PAUL', '-850')], [manual]);
    expect(marks.a.nearOf).toEqual({ date: '2026-11-25', description: 'Boulangerie' });
    expect(marks.a.duplicateOf).toBeUndefined();
  });

  it('accepte 1 à 3 jours, refuse 0 (autre libellé) et 4 jours', () => {
    const near = (date: string) => markImportRows([row('a', date, 'Autre', '-850')], [manual]).a?.nearOf;
    expect(near('2026-11-28')).toBeDefined();
    expect(near('2026-11-22')).toBeDefined();
    expect(near('2026-11-29')).toBeUndefined();
    expect(near('2026-11-21')).toBeUndefined();
    expect(near('2026-11-25')).toBeUndefined();
  });

  it('même libellé à un autre jour : proche', () => {
    const marks = markImportRows([row('a', '2026-11-27', 'Boulangerie', '-850')], [manual]);
    expect(marks.a.nearOf).toBeDefined();
  });

  it('le montant doit être identique', () => {
    expect(markImportRows([row('a', '2026-11-26', 'Boulangerie', '-851')], [manual])).toEqual({});
  });

  it('ignore les pending et choisit l écart le plus petit', () => {
    const marks = markImportRows(
      [row('a', '2026-11-26', 'X', '-850')],
      [tx('p', '2026-11-26', 'Y', '-850', true), tx('far', '2026-11-23', 'Far', '-850'), manual],
    );
    expect(marks.a.nearOf?.description).toBe('Boulangerie');
  });

  it('une ligne appariée à une identique n est jamais signalée proche de cette transaction', () => {
    const marks = markImportRows(
      [row('a', '2026-11-25', 'Boulangerie', '-850')],
      [manual, tx('t2', '2026-11-26', 'Boulangerie', '-850')],
    );
    expect(marks.a.duplicateOf?.date).toBe('2026-11-25');
    expect(marks.a.nearOf).toBeUndefined();
  });

  it('une transaction déjà prise par une identique n est pas proposée comme proche d une autre ligne', () => {
    const marks = markImportRows(
      [row('a', '2026-11-25', 'Boulangerie', '-850'), row('b', '2026-11-26', 'Boulangerie', '-850')],
      [manual],
    );
    expect(marks.a.duplicateOf).toBeDefined();
    expect(marks.b).toBeUndefined();
  });
});

describe('windowForRows', () => {
  it('va de la première date moins 3 jours à la dernière plus 3 jours, lignes lisibles seulement', () => {
    expect(
      windowForRows([
        row('a', '2026-03-02', 'A', '1'),
        row('b', '2026-02-28', 'B', '1'),
        row('x', '2026-01-01', 'X', '1', true),
      ]),
    ).toEqual({ startDate: '2026-02-25', endDate: '2026-03-05' });
    expect(windowForRows([row('x', 'n/a', 'X', '', true)])).toBeNull();
  });
});
