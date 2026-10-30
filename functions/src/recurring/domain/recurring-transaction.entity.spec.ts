import { RecurringTransaction } from './recurring-transaction.entity';

describe('RecurringTransaction', () => {
  const base = {
    accountId: 'acc-1',
    categoryId: 'cat-1',
    description: 'Loyer',
    amount: BigInt(-85000),
    dayOfMonth: 5,
  };

  it('creates a recurring transaction with an id and timestamps', () => {
    const r = RecurringTransaction.create(base);

    expect(r.id).toBeDefined();
    expect(r.amount).toBe(BigInt(-85000));
    expect(r.createdAt).toBeInstanceOf(Date);
  });

  it.each([1, 31])('accepts day %i', (dayOfMonth) => {
    expect(
      RecurringTransaction.create({ ...base, dayOfMonth }).dayOfMonth,
    ).toBe(dayOfMonth);
  });

  it.each([0, 32, -1])('rejects day %i', (dayOfMonth) => {
    expect(() => RecurringTransaction.create({ ...base, dayOfMonth })).toThrow(
      'Day of month must be between 1 and 31',
    );
  });

  it.each(['', '  '])('rejects an empty description (%j)', (description) => {
    expect(() => RecurringTransaction.create({ ...base, description })).toThrow(
      'Description is required',
    );
  });

  it('requires an account', () => {
    expect(() =>
      RecurringTransaction.create({ ...base, accountId: '' }),
    ).toThrow('Account ID is required');
  });

  it('allows no category', () => {
    expect(
      RecurringTransaction.create({ ...base, categoryId: null }).categoryId,
    ).toBeNull();
  });
});
