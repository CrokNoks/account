import { isRecurringDueOn, recurringDayInMonth } from './recurring-day';

describe('recurringDayInMonth', () => {
  it('keeps a day that exists in the month', () => {
    expect(recurringDayInMonth(15, new Date(2026, 3, 1))).toBe(15);
    expect(recurringDayInMonth(31, new Date(2026, 4, 1))).toBe(31);
  });

  it('clamps to the last day of the month', () => {
    expect(recurringDayInMonth(31, new Date(2026, 3, 10))).toBe(30);
    expect(recurringDayInMonth(30, new Date(2026, 1, 10))).toBe(28);
    expect(recurringDayInMonth(29, new Date(2026, 1, 10))).toBe(28);
    expect(recurringDayInMonth(31, new Date(2028, 1, 10))).toBe(29);
  });
});

describe('isRecurringDueOn', () => {
  it('is due exactly once a month, on the last day when the day does not exist', () => {
    const due = (y: number, m: number, day: number) => {
      let count = 0;
      for (let d = 1; d <= 31; d++) {
        const date = new Date(y, m, d);
        if (date.getMonth() === m && isRecurringDueOn(day, date)) count++;
      }
      return count;
    };

    expect(due(2026, 3, 31)).toBe(1); // avril
    expect(due(2026, 1, 30)).toBe(1); // février
    expect(due(2026, 4, 31)).toBe(1); // mai
    expect(due(2026, 3, 15)).toBe(1);
    expect(isRecurringDueOn(31, new Date(2026, 3, 30))).toBe(true);
    expect(isRecurringDueOn(31, new Date(2026, 3, 29))).toBe(false);
    expect(isRecurringDueOn(29, new Date(2026, 1, 28))).toBe(true);
  });
});
