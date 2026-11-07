import { isRecurringAlreadyPaid } from './recurring-already-paid';

const DAY = new Date('2026-04-28T00:00:00.000Z');
const internet = { description: 'Internet', amount: BigInt(-3000) };
const tx = (
  over: Partial<{ date: Date; description: string; amount: bigint }>,
) => ({
  date: DAY,
  description: 'Prélèvement Internet',
  amount: BigInt(-3000),
  ...over,
});

describe('isRecurringAlreadyPaid', () => {
  it('is true for a same-day, same-amount transaction whose label contains the recurring one', () => {
    expect(isRecurringAlreadyPaid(internet, DAY, [tx({})])).toBe(true);
  });

  it('ignores the case', () => {
    expect(
      isRecurringAlreadyPaid(internet, DAY, [
        tx({ description: 'INTERNET SFR' }),
      ]),
    ).toBe(true);
    expect(
      isRecurringAlreadyPaid({ ...internet, description: 'internet' }, DAY, [
        tx({ description: 'Internet SFR' }),
      ]),
    ).toBe(true);
  });

  it.each([BigInt(-2999), BigInt(3000)])(
    'is false for another amount (%s)',
    (amount) => {
      expect(isRecurringAlreadyPaid(internet, DAY, [tx({ amount })])).toBe(
        false,
      );
    },
  );

  it.each(['Edf', 'Int'])(
    'is false when the label "%s" does not contain the recurring one',
    (description) => {
      expect(isRecurringAlreadyPaid(internet, DAY, [tx({ description })])).toBe(
        false,
      );
    },
  );

  it.each(['2026-04-27', '2026-04-29'])(
    'is false for another day (%s)',
    (d) => {
      expect(
        isRecurringAlreadyPaid(internet, DAY, [tx({ date: new Date(d) })]),
      ).toBe(false);
    },
  );

  it('is false without any transaction', () => {
    expect(isRecurringAlreadyPaid(internet, DAY, [])).toBe(false);
  });

  it('does not look at the status or the category (only date, amount, label)', () => {
    const pending = {
      ...tx({}),
      pending: true,
      reconciled: false,
      categoryId: 'c-9',
    };
    expect(isRecurringAlreadyPaid(internet, DAY, [pending])).toBe(true);
  });

  it('keeps the current behaviour: one transaction pays two identical recurrings', () => {
    const transactions = [tx({})];
    expect(isRecurringAlreadyPaid(internet, DAY, transactions)).toBe(true);
    expect(isRecurringAlreadyPaid({ ...internet }, DAY, transactions)).toBe(
      true,
    );
  });
});
