import { dueDateMetadata, readDueDate } from './recurring-due-date';

describe('readDueDate', () => {
  it('reads a valid YYYY-MM-DD as a date-only (midnight UTC)', () => {
    expect(readDueDate({ dueDate: '2026-11-30' })).toEqual(
      new Date('2026-11-30T00:00:00.000Z'),
    );
  });

  it('keeps the other metadata keys out of the way', () => {
    expect(readDueDate({ source: 'recurring', dueDate: '2026-02-28' })).toEqual(
      new Date('2026-02-28'),
    );
  });

  it.each([
    ['absent', {}],
    ['abc', { dueDate: 'abc' }],
    ['ISO with time', { dueDate: '2026-11-30T00:00:00Z' }],
    ['impossible day', { dueDate: '2026-02-30' }],
    ['month 13', { dueDate: '2026-13-01' }],
    ['number', { dueDate: 20261130 }],
    ['null', { dueDate: null }],
  ])('ignores an invalid value (%s) without throwing', (_label, metadata) => {
    expect(readDueDate(metadata)).toBeUndefined();
  });

  it.each([[undefined], [null], ['2026-11-30'], [42]])(
    'ignores metadata that is not an object (%p)',
    (metadata) => {
      expect(readDueDate(metadata)).toBeUndefined();
    },
  );
});

describe('dueDateMetadata', () => {
  it('writes the date-only string, whatever the time of the date', () => {
    expect(dueDateMetadata(new Date('2026-12-30'))).toEqual({
      dueDate: '2026-12-30',
    });
  });

  it('round-trips with readDueDate', () => {
    const date = new Date('2026-03-31');
    expect(readDueDate(dueDateMetadata(date))).toEqual(date);
  });
});
