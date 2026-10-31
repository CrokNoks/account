import {
  addDaysDateOnly,
  addMonthsDateOnly,
  dateOnly,
  eachDayDateOnly,
  endOfMonthDateOnly,
  formatDateOnlyFr,
  parseDateOnly,
  startOfMonthDateOnly,
  toDateOnly,
  todayDateOnly,
} from './date-only';

describe('date-only', () => {
  afterEach(() => jest.useRealTimers());

  describe('todayDateOnly', () => {
    it('is the calendar date in the business time zone, whatever the server time zone', () => {
      // 31 oct. 23:30 UTC = 1er nov. 00:30 à Paris (UTC+1)
      expect(toDateOnly(todayDateOnly(new Date('2026-10-31T23:30:00Z')))).toBe(
        '2026-11-01',
      );
      // 31 oct. 22:30 UTC = 31 oct. 23:30 à Paris
      expect(toDateOnly(todayDateOnly(new Date('2026-10-31T22:30:00Z')))).toBe(
        '2026-10-31',
      );
    });

    it('returns midnight UTC', () => {
      expect(
        todayDateOnly(new Date('2026-04-28T08:00:00Z')).toISOString(),
      ).toBe('2026-04-28T00:00:00.000Z');
    });

    it('uses the current time by default', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-31T23:30:00Z'));
      expect(toDateOnly(todayDateOnly())).toBe('2026-11-01');
    });
  });

  it('parses the calendar date written by the client', () => {
    expect(parseDateOnly('2026-11-01').toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
    expect(parseDateOnly('2026-11-01T23:30:00-05:00').toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });

  it('does arithmetic on calendar days (DST-safe)', () => {
    expect(toDateOnly(addDaysDateOnly(dateOnly(2026, 10, 24), 2))).toBe(
      '2026-10-26',
    );
    expect(toDateOnly(addDaysDateOnly(dateOnly(2026, 3, 28), 2))).toBe(
      '2026-03-30',
    );
    expect(toDateOnly(addDaysDateOnly(dateOnly(2026, 11, 1), -1))).toBe(
      '2026-10-31',
    );
  });

  it('adds months and clamps the day', () => {
    expect(toDateOnly(addMonthsDateOnly(dateOnly(2026, 1, 31), 1))).toBe(
      '2026-02-28',
    );
    expect(toDateOnly(addMonthsDateOnly(dateOnly(2026, 6, 15), -6))).toBe(
      '2025-12-15',
    );
  });

  it('computes month bounds and day lists', () => {
    expect(toDateOnly(startOfMonthDateOnly(dateOnly(2026, 2, 17)))).toBe(
      '2026-02-01',
    );
    expect(toDateOnly(endOfMonthDateOnly(dateOnly(2028, 2, 17)))).toBe(
      '2028-02-29',
    );
    expect(
      eachDayDateOnly(dateOnly(2026, 2, 27), dateOnly(2026, 3, 2)).map(
        toDateOnly,
      ),
    ).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it('formats dd/MM/yyyy', () => {
    expect(formatDateOnlyFr(dateOnly(2026, 11, 1))).toBe('01/11/2026');
  });
});
