import { dateOnly } from './date-only';
import {
  isRecurringDueOn,
  recurringDayInMonth,
  recurringOccurrences,
} from './recurring-day';

describe('recurringDayInMonth', () => {
  it('keeps a day that exists in the month', () => {
    expect(recurringDayInMonth(15, dateOnly(2026, 4, 1))).toBe(15);
    expect(recurringDayInMonth(31, dateOnly(2026, 5, 1))).toBe(31);
  });

  it('clamps to the last day of the month', () => {
    expect(recurringDayInMonth(31, dateOnly(2026, 4, 10))).toBe(30);
    expect(recurringDayInMonth(30, dateOnly(2026, 2, 10))).toBe(28);
    expect(recurringDayInMonth(29, dateOnly(2026, 2, 10))).toBe(28);
    expect(recurringDayInMonth(31, dateOnly(2028, 2, 10))).toBe(29);
  });
});

describe('isRecurringDueOn', () => {
  it('is due exactly once a month, on the last day when the day does not exist', () => {
    const due = (y: number, m: number, day: number) => {
      let count = 0;
      for (let d = 1; d <= 31; d++) {
        const date = dateOnly(y, m + 1, d);
        if (date.getUTCMonth() === m && isRecurringDueOn(day, date)) count++;
      }
      return count;
    };

    expect(due(2026, 3, 31)).toBe(1); // avril
    expect(due(2026, 1, 30)).toBe(1); // février
    expect(due(2026, 4, 31)).toBe(1); // mai
    expect(due(2026, 3, 15)).toBe(1);
    expect(isRecurringDueOn(31, dateOnly(2026, 4, 30))).toBe(true);
    expect(isRecurringDueOn(31, dateOnly(2026, 4, 29))).toBe(false);
    expect(isRecurringDueOn(29, dateOnly(2026, 2, 28))).toBe(true);
  });
});

describe('recurringOccurrences', () => {
  const iso = (dates: Date[]) => dates.map((d) => d.toISOString().slice(0, 10));

  it('creates the occurrence of the next month for a period spanning two months (25 Oct to 24 Nov, day 5)', () => {
    expect(
      iso(
        recurringOccurrences(5, dateOnly(2026, 10, 25), dateOnly(2026, 11, 24)),
      ),
    ).toEqual(['2026-11-05']);
  });

  it('keeps one occurrence for a calendar month period', () => {
    expect(
      iso(
        recurringOccurrences(5, dateOnly(2026, 11, 1), dateOnly(2026, 11, 30)),
      ),
    ).toEqual(['2026-11-05']);
  });

  it('creates several occurrences for a period longer than a month', () => {
    expect(
      iso(
        recurringOccurrences(5, dateOnly(2026, 10, 1), dateOnly(2026, 12, 31)),
      ),
    ).toEqual(['2026-10-05', '2026-11-05', '2026-12-05']);
  });

  it('drops the occurrences outside the period, bounds included', () => {
    expect(
      iso(
        recurringOccurrences(5, dateOnly(2026, 11, 6), dateOnly(2026, 12, 4)),
      ),
    ).toEqual([]);
    expect(
      iso(
        recurringOccurrences(5, dateOnly(2026, 11, 5), dateOnly(2026, 12, 5)),
      ),
    ).toEqual(['2026-11-05', '2026-12-05']);
  });

  it('brings a day missing from a short month back to its last day', () => {
    expect(
      iso(
        recurringOccurrences(31, dateOnly(2026, 1, 1), dateOnly(2026, 4, 30)),
      ),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('returns nothing when the end is before the start', () => {
    expect(
      recurringOccurrences(5, dateOnly(2026, 11, 10), dateOnly(2026, 11, 1)),
    ).toEqual([]);
  });
});
