import { Logger } from '@nestjs/common';
import { GetCashflowForecastUseCase } from './get-cashflow-forecast.use-case';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { Account } from '../../accounts/domain/account.entity';
import { RecurringTransaction } from '../../recurring/domain/recurring-transaction.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { computeLowPoint } from '../domain/cashflow-low-point';

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
  let transactions: {
    sumAmountByAccountBeforeDate: jest.Mock;
    findAllByAccountUnpaginated: jest.Mock;
  };
  let logSpy: jest.SpyInstance;
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
      findAllByAccountUnpaginated: jest.fn().mockResolvedValue([]),
    };
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
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

  afterEach(() => {
    jest.useRealTimers();
    logSpy.mockRestore();
  });

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
      startDate: '2026-04-28T00:00:00.000Z',
      lowPoint: { date: '2026-04-28T00:00:00.000Z', balance: '105000' },
    });
  });

  it('gives the first day of the curve in the business time zone', async () => {
    // 31 oct. 23:30 UTC = 1er nov. 00:30 à Paris
    jest.setSystemTime(new Date('2026-10-31T23:30:00Z'));

    const { startDate } = await useCase.execute('acc-1', 5);

    expect(startDate).toBe('2026-11-01T00:00:00.000Z');
  });

  it('rejects an unknown account', async () => {
    accounts.findById.mockResolvedValue(null);

    await expect(useCase.execute('acc-1')).rejects.toThrow('Account not found');
  });

  describe('récurrence déjà payée aujourd’hui', () => {
    const internet = () => recurring('Internet', -3000, 28);
    const paid = (
      description: string,
      amount: number,
      date = '2026-04-28',
      pending = false,
    ) =>
      Transaction.create({
        accountId: 'acc-1',
        categoryId: null,
        date: new Date(date),
        description,
        amount: BigInt(amount),
        reconciled: false,
        pending,
        metadata: {},
      });

    beforeEach(() => {
      recurrings.findAllByAccount.mockResolvedValue([internet()]);
    });

    it('counts it once (in the balance of the day) when paid today', async () => {
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        paid('Prélèvement internet', -3000),
      ]);

      const r = await useCase.execute('acc-1', 5);

      expect(r.events).toEqual([]);
      expect(r.currentBalance).toBe('105000');
      expect(r.lowPoint).toEqual({
        date: '2026-04-28T00:00:00.000Z',
        balance: '105000',
      });
    });

    it('reads only the transactions of today', async () => {
      await useCase.execute('acc-1', 5);

      expect(transactions.findAllByAccountUnpaginated).toHaveBeenCalledWith(
        'acc-1',
        {
          startDate: new Date('2026-04-28T00:00:00.000Z'),
          endDate: new Date('2026-04-28T00:00:00.000Z'),
        },
      );
    });

    it('counts it when not paid', async () => {
      const r = await useCase.execute('acc-1', 5);

      expect(
        r.events.map((e) => [e.date, e.description, e.projectedBalance]),
      ).toEqual([['2026-04-28T00:00:00.000Z', 'Internet', '102000']]);
      expect(r.lowPoint).toEqual({
        date: '2026-04-28T00:00:00.000Z',
        balance: '102000',
      });
    });

    it.each([
      ['another amount', [paid('Internet', -2999)]],
      ['another label', [paid('Edf', -3000)]],
      ['another day', [paid('Internet', -3000, '2026-04-27')]],
    ])('counts it with %s', async (_n, txs) => {
      transactions.findAllByAccountUnpaginated.mockResolvedValue(txs);

      const r = await useCase.execute('acc-1', 5);

      expect(r.events).toHaveLength(1);
    });

    it('ignores the case', async () => {
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        paid('INTERNET', -3000),
      ]);

      expect((await useCase.execute('acc-1', 5)).events).toEqual([]);
    });

    it('discards a pending transaction of today the same way', async () => {
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        paid('Internet', -3000, '2026-04-28', true),
      ]);

      expect((await useCase.execute('acc-1', 5)).events).toEqual([]);
    });

    it('keeps the current behaviour for two identical recurrings and one transaction', async () => {
      recurrings.findAllByAccount.mockResolvedValue([internet(), internet()]);
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        paid('Internet', -3000),
      ]);

      const r = await useCase.execute('acc-1', 5);

      expect(r.events).toEqual([]);
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'cashflow_forecast_built',
          recurringCount: 2,
          alreadyPaidCount: 2,
        }),
      );
    });

    it('counts two identical recurrings without transaction', async () => {
      recurrings.findAllByAccount.mockResolvedValue([internet(), internet()]);

      expect((await useCase.execute('acc-1', 5)).events).toHaveLength(2);
    });

    it('never discards a future day: its transaction is not in the balance', async () => {
      recurrings.findAllByAccount.mockResolvedValue([
        recurring('Salaire', 250000, 30),
      ]);
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        paid('Salaire', 250000, '2026-04-30'),
      ]);

      const r = await useCase.execute('acc-1', 5);

      expect(r.events.map((e) => e.date)).toEqual(['2026-04-30T00:00:00.000Z']);
    });

    it('counts a pending of tomorrow with its recurring once', async () => {
      recurrings.findAllByAccount.mockResolvedValue([
        recurring('Internet', -3000, 29),
      ]);
      transactions.findAllByAccountUnpaginated.mockResolvedValue([]);

      const r = await useCase.execute('acc-1', 5);

      expect(r.events).toHaveLength(1);
      expect(r.events[0].projectedBalance).toBe('102000');
    });

    it('discards a day-31 recurring paid on 30 April', async () => {
      jest.setSystemTime(new Date('2026-04-30T08:00:00Z'));
      recurrings.findAllByAccount.mockResolvedValue([
        recurring('Fin de mois longue', -100, 31),
      ]);
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        paid('Fin de mois longue', -100, '2026-04-30'),
      ]);

      expect((await useCase.execute('acc-1', 5)).events).toEqual([]);
    });

    it('puts several events on the same day', async () => {
      jest.setSystemTime(new Date('2026-04-28T08:00:00Z'));
      recurrings.findAllByAccount.mockResolvedValue([
        recurring('Salaire', 250000, 30),
        recurring('Fin de mois longue', -100, 31),
      ]);

      const r = await useCase.execute('acc-1', 5);

      expect(
        r.events.filter((e) => e.date === '2026-04-30T00:00:00.000Z'),
      ).toHaveLength(2);
    });
  });

  describe('point bas', () => {
    beforeEach(() => {
      recurrings.findAllByAccount.mockResolvedValue([
        recurring('Loyer', -85000, 1),
        recurring('Gros', -50000, 15),
      ]);
    });

    it.each([
      [30, '2026-05-15T00:00:00.000Z', '-30000'],
      [60, '2026-06-15T00:00:00.000Z', '-165000'],
      [90, '2026-07-15T00:00:00.000Z', '-300000'],
    ])('changes with the horizon (%s days)', async (days, date, balance) => {
      const r = await useCase.execute('acc-1', days);

      expect(r.lowPoint).toEqual({ date, balance });
    });

    it('is the same as computeLowPoint on the returned events', async () => {
      const r = await useCase.execute('acc-1', 90);

      const expected = computeLowPoint(
        new Date('2026-04-28T00:00:00.000Z'),
        BigInt(r.currentBalance),
        r.events.map((e) => ({ date: e.date, amount: BigInt(e.amount) })),
      );
      expect(r.lowPoint).toEqual({
        date: expected.date,
        balance: expected.balance.toString(),
      });
    });
  });

  it('logs cashflow_forecast_built without amount nor label', async () => {
    recurrings.findAllByAccount.mockResolvedValue([
      recurring('Loyer', -85000, 1),
    ]);

    await useCase.execute('acc-1', 30);

    expect(logSpy).toHaveBeenCalledWith({
      event: 'cashflow_forecast_built',
      accountId: 'acc-1',
      days: 30,
      recurringCount: 1,
      alreadyPaidCount: 0,
    });
  });
});
