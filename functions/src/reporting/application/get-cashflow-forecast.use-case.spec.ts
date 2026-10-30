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
    // 28 avril 2026, heure locale
    jest.useFakeTimers().setSystemTime(new Date(2026, 3, 28, 10, 0, 0));
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
      new Date(2026, 3, 29, 0, 0, 0),
    );
    expect(result.currentBalance).toBe('105000');
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
      [
        new Date(2026, 3, 30).toISOString(),
        'Salaire',
        '250000',
        '355000',
        'recurring',
      ],
      [
        new Date(2026, 4, 1).toISOString(),
        'Loyer',
        '-85000',
        '270000',
        'recurring',
      ],
    ]);
  });

  // Comportement actuel : une récurrente du 31 est ignorée les mois de 30 jours
  // (et un 29/30/31 en février).
  it('skips a day-31 recurring transaction in a 30-day month', async () => {
    const { events } = await useCase.execute('acc-1', 5);

    expect(events.some((e) => e.description === 'Fin de mois longue')).toBe(
      false,
    );
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
      new Date(2026, 4, 1).toISOString(),
      new Date(2026, 5, 1).toISOString(),
      new Date(2026, 6, 1).toISOString(),
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
