import { GetCashflowForecastUseCase } from './get-cashflow-forecast.use-case';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { Account } from '../../accounts/domain/account.entity';
import { RecurringTransaction } from '../../recurring/domain/recurring-transaction.entity';

const recurring = (description: string, amount: number, dayOfMonth: number) =>
  RecurringTransaction.create({
    accountId: 'acc-1',
    categoryId: null,
    description,
    amount: BigInt(amount),
    dayOfMonth,
  });

describe('GetCashflowForecastUseCase', () => {
  let accounts: { findById: jest.Mock };
  let transactions: { sumAmountByAccountBeforeDate: jest.Mock };
  let recurrings: { findAllByAccount: jest.Mock };
  let useCase: GetCashflowForecastUseCase;

  beforeEach(() => {
    // 28 avril 2026, 10 h à Paris (fuseau métier)
    jest.useFakeTimers().setSystemTime(new Date('2026-04-28T08:00:00Z'));
    accounts = {
      findById: jest.fn().mockResolvedValue(
        new Account({
          id: 'acc-1',
          name: 'Courant',
          ownerId: 'u-1',
          initialBalance: BigInt(100000),
        }),
      ),
    };
    transactions = {
      sumAmountByAccountBeforeDate: jest.fn().mockResolvedValue(BigInt(5000)),
    };
    recurrings = {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([
          recurring('Loyer', -85000, 1),
          recurring('Salaire', 250000, 30),
          recurring('Fin de mois longue', -100, 31),
        ]),
    };
    useCase = new GetCashflowForecastUseCase(
      accounts as unknown as AccountRepository,
      transactions as unknown as TransactionRepository,
      recurrings as unknown as RecurringTransactionRepository,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('computes the current balance with every transaction up to today included', async () => {
    const result = await useCase.execute('acc-1', 5);

    expect(transactions.sumAmountByAccountBeforeDate).toHaveBeenCalledWith(
      'acc-1',
      new Date('2026-04-29T00:00:00.000Z'),
    );
    expect(result.currentBalance).toBe('105000');
  });

  it('counts the transactions dated today when the clock is just past midnight in the business time zone', async () => {
    // 31 oct. 23:30 UTC = 1er nov. 00:30 à Paris : aujourd'hui = 1er novembre
    jest.setSystemTime(new Date('2026-10-31T23:30:00Z'));

    await useCase.execute('acc-1', 5);

    expect(transactions.sumAmountByAccountBeforeDate).toHaveBeenCalledWith(
      'acc-1',
      new Date('2026-11-02T00:00:00.000Z'),
    );
  });

  it('projects recurring transactions day by day with a running balance', async () => {
    const { events } = await useCase.execute('acc-1', 5);

    expect(
      events.map((e) => [
        e.date,
        e.description,
        e.amount,
        e.projectedBalance,
        e.type,
      ]),
    ).toEqual([
      ['2026-04-30T00:00:00.000Z', 'Salaire', '250000', '355000', 'recurring'],
      [
        '2026-04-30T00:00:00.000Z',
        'Fin de mois longue',
        '-100',
        '354900',
        'recurring',
      ],
      ['2026-05-01T00:00:00.000Z', 'Loyer', '-85000', '269900', 'recurring'],
    ]);
  });

  it('places a day-31 recurring transaction on the last day of a 30-day month', async () => {
    const { events } = await useCase.execute('acc-1', 5);

    const long = events.filter((e) => e.description === 'Fin de mois longue');
    expect(long.map((e) => e.date)).toEqual(['2026-04-30T00:00:00.000Z']);
  });

  it('places day 29/30/31 recurring transactions on 28 February, once', async () => {
    jest.setSystemTime(new Date('2026-02-20T09:00:00Z'));
    recurrings.findAllByAccount.mockResolvedValue([
      recurring('Trente', -1, 30),
      recurring('Trente et un', -2, 31),
    ]);

    const { events } = await useCase.execute('acc-1', 15); // jusqu'au 7 mars

    expect(events.map((e) => [e.description, e.date])).toEqual([
      ['Trente', '2026-02-28T00:00:00.000Z'],
      ['Trente et un', '2026-02-28T00:00:00.000Z'],
    ]);
  });

  it('includes today and the last day of the horizon', async () => {
    recurrings.findAllByAccount.mockResolvedValue([
      recurring('Aujourd’hui', -1, 28),
      recurring('Dernier jour', -2, 3),
    ]);

    const { events } = await useCase.execute('acc-1', 5);

    expect(events.map((e) => e.description)).toEqual([
      'Aujourd’hui',
      'Dernier jour',
    ]);
  });

  it('repeats a recurring transaction every month over the default 90 days', async () => {
    recurrings.findAllByAccount.mockResolvedValue([
      recurring('Loyer', -85000, 1),
    ]);

    const { events } = await useCase.execute('acc-1');

    expect(events.map((e) => e.date)).toEqual([
      '2026-05-01T00:00:00.000Z',
      '2026-06-01T00:00:00.000Z',
      '2026-07-01T00:00:00.000Z',
    ]);
    expect(events.at(-1)?.projectedBalance).toBe(String(105000 - 3 * 85000));
  });

  it('returns no event without recurring transactions', async () => {
    recurrings.findAllByAccount.mockResolvedValue([]);

    expect(await useCase.execute('acc-1', 30)).toEqual({
      currentBalance: '105000',
      events: [],
    });
  });

  it('rejects an unknown account', async () => {
    accounts.findById.mockResolvedValue(null);

    await expect(useCase.execute('acc-1')).rejects.toThrow('Account not found');
  });
});
