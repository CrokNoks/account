import { Test, TestingModule } from '@nestjs/testing';
import { GetAnomaliesUseCase } from './get-anomalies.use-case';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { subMonths } from 'date-fns';

describe('GetAnomaliesUseCase', () => {
  let useCase: GetAnomaliesUseCase;
  let transactionRepository: jest.Mocked<TransactionRepository>;

  const accountId = 'acc-1';
  const now = new Date(2026, 5, 15); // June 15, 2026

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAnomaliesUseCase,
        {
          provide: TransactionRepository,
          useValue: {
            findAllByAccountUnpaginated: jest.fn(),
          },
        },
        {
          provide: PeriodRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetAnomaliesUseCase>(GetAnomaliesUseCase);
    transactionRepository = module.get(TransactionRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects a period of another account without reading transactions', async () => {
    const periods = (
      useCase as unknown as {
        periodRepository: { findById: jest.Mock };
      }
    ).periodRepository;
    periods.findById.mockResolvedValue({
      id: 'per-1',
      accountId: 'acc-other',
      startDate: new Date(2026, 5, 1),
      endDate: null,
    });

    await expect(useCase.execute(accountId, 'per-1')).rejects.toThrow(
      'Period not found',
    );
    expect(
      transactionRepository.findAllByAccountUnpaginated,
    ).not.toHaveBeenCalled();
  });

  it('analyses the current month up to today, today included, just after midnight in the business time zone', async () => {
    jest.setSystemTime(new Date('2026-10-31T23:30:00Z')); // 1er nov. à Paris
    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue([]);

    await useCase.execute(accountId);

    expect(
      transactionRepository.findAllByAccountUnpaginated,
    ).toHaveBeenCalledWith(accountId, {
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-11-01T00:00:00.000Z'),
    });
  });

  it('should detect duplicate transactions on the same day', async () => {
    const tx1 = Transaction.create({
      id: 'tx-1',
      accountId,
      categoryId: 'cat-1',
      date: new Date(2026, 5, 10),
      description: 'Uber Eats',
      amount: BigInt(-2500), // 25€
      reconciled: false,
      pending: false,
      metadata: {},
    });

    const tx2 = Transaction.create({
      id: 'tx-2',
      accountId,
      categoryId: 'cat-1',
      date: new Date(2026, 5, 10),
      description: 'Uber Eats PEND', // Description doesn't matter for this strict check, only date+amount
      amount: BigInt(-2500),
      reconciled: false,
      pending: true,
      metadata: {},
    });

    const txNormal = Transaction.create({
      id: 'tx-3',
      accountId,
      categoryId: 'cat-2',
      date: new Date(2026, 5, 11),
      description: 'Normal Expense',
      amount: BigInt(-1000),
      reconciled: false,
      pending: false,
      metadata: {},
    });

    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue([
      tx1,
      tx2,
      txNormal,
    ]);

    const anomalies = await useCase.execute(accountId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].type).toBe('duplicate');
    expect(anomalies[0].transactionIds).toEqual(['tx-1', 'tx-2']);
  });

  it('does not flag as duplicates two identical transactions of different categories', async () => {
    const make = (id: string, categoryId: string | null) =>
      Transaction.create({
        id,
        accountId,
        categoryId,
        date: new Date(2026, 5, 10),
        description: 'Orange mobile',
        amount: BigInt(-1999),
        reconciled: false,
        pending: false,
        metadata: {},
      });

    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue([
      make('tx-1', 'cat-1'),
      make('tx-2', 'cat-2'),
      make('tx-3', null),
    ]);

    const anomalies = await useCase.execute(accountId);

    expect(anomalies.filter((a) => a.type === 'duplicate')).toHaveLength(0);
  });

  it('still flags as duplicates two identical transactions both without category', async () => {
    const make = (id: string) =>
      Transaction.create({
        id,
        accountId,
        categoryId: null,
        date: new Date(2026, 5, 10),
        description: 'Orange mobile',
        amount: BigInt(-1999),
        reconciled: false,
        pending: false,
        metadata: {},
      });

    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue([
      make('tx-1'),
      make('tx-2'),
    ]);

    const anomalies = await useCase.execute(accountId);

    expect(anomalies.map((a) => a.transactionIds)).toEqual([['tx-1', 'tx-2']]);
  });

  it('should ignore small amounts (<5€) and incomes for duplicates', async () => {
    const txSmall1 = Transaction.create({
      id: 'tx-1',
      accountId,
      categoryId: 'cat-1',
      date: new Date(2026, 5, 10),
      description: 'Baguette',
      amount: BigInt(-120),
      reconciled: false,
      pending: false,
      metadata: {},
    });
    const txSmall2 = Transaction.create({
      id: 'tx-2',
      accountId,
      categoryId: 'cat-1',
      date: new Date(2026, 5, 10),
      description: 'Baguette',
      amount: BigInt(-120),
      reconciled: false,
      pending: false,
      metadata: {},
    });

    const txIncome1 = Transaction.create({
      id: 'tx-3',
      accountId,
      categoryId: 'cat-2',
      date: new Date(2026, 5, 10),
      description: 'Virement',
      amount: BigInt(5000),
      reconciled: false,
      pending: false,
      metadata: {},
    });
    const txIncome2 = Transaction.create({
      id: 'tx-4',
      accountId,
      categoryId: 'cat-2',
      date: new Date(2026, 5, 10),
      description: 'Virement',
      amount: BigInt(5000),
      reconciled: false,
      pending: false,
      metadata: {},
    });

    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue([
      txSmall1,
      txSmall2,
      txIncome1,
      txIncome2,
    ]);

    const anomalies = await useCase.execute(accountId);

    expect(anomalies).toHaveLength(0);
  });

  it('should detect outlier transactions (> 3x average)', async () => {
    // 3 historical transactions in the same category averaging -10€ (-1000 cents)
    const history = [
      Transaction.create({
        id: 'h1',
        accountId,
        categoryId: 'cat-1',
        date: new Date(2026, 2, 1),
        description: 'Test',
        amount: BigInt(-1000),
        reconciled: false,
        pending: false,
        metadata: {},
      }),
      Transaction.create({
        id: 'h2',
        accountId,
        categoryId: 'cat-1',
        date: new Date(2026, 3, 1),
        description: 'Test',
        amount: BigInt(-1000),
        reconciled: false,
        pending: false,
        metadata: {},
      }),
      Transaction.create({
        id: 'h3',
        accountId,
        categoryId: 'cat-1',
        date: new Date(2026, 4, 1),
        description: 'Test',
        amount: BigInt(-1000),
        reconciled: false,
        pending: false,
        metadata: {},
      }),
    ];

    // Current transaction in the same category is -40€ (-4000 cents), which is 4x the average
    const outlier = Transaction.create({
      id: 'out-1',
      accountId,
      categoryId: 'cat-1',
      date: new Date(2026, 5, 10),
      description: 'Big Expense',
      amount: BigInt(-4000),
      reconciled: false,
      pending: false,
      metadata: {},
    });

    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue([
      ...history,
      outlier,
    ]);

    const anomalies = await useCase.execute(accountId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].type).toBe('outlier');
    expect(anomalies[0].transactionIds).toEqual(['out-1']);
  });

  it('should ignore anomalies marked in metadata', async () => {
    const accountId = 'acc-1';
    const now = new Date();

    const transactions = [
      Transaction.create({
        id: 'out-1',
        accountId,
        categoryId: 'cat-1',
        date: now,
        description: 'Outlier',
        amount: BigInt(-100000), // 1000€
        reconciled: false,
        pending: false,
        metadata: { ignoredAnomalies: ['outlier'] },
      }),
      Transaction.create({
        id: 'h1',
        accountId,
        categoryId: 'cat-1',
        date: subMonths(now, 1),
        description: 'H1',
        amount: BigInt(-1000),
        reconciled: false,
        pending: false,
      }),
      Transaction.create({
        id: 'h2',
        accountId,
        categoryId: 'cat-1',
        date: subMonths(now, 2),
        description: 'H2',
        amount: BigInt(-1100),
        reconciled: false,
        pending: false,
      }),
      Transaction.create({
        id: 'h3',
        accountId,
        categoryId: 'cat-1',
        date: subMonths(now, 3),
        description: 'H3',
        amount: BigInt(-900),
        reconciled: false,
        pending: false,
      }),
    ];

    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue(
      transactions,
    );

    const anomalies = await useCase.execute(accountId);

    expect(anomalies).toHaveLength(0);
  });
});

describe('GetAnomaliesUseCase : fenêtre de période (factures réservées)', () => {
  const accountId = 'acc-1';
  const mk = (
    id: string,
    date: string,
    amount: number,
    cat = 'cat-1',
    pending = false,
  ) =>
    Transaction.create({
      id,
      accountId,
      categoryId: cat,
      date: new Date(date),
      description: id,
      amount: BigInt(amount),
      reconciled: false,
      pending,
    });

  const build = (
    period: { endDate: Date | null; isActive: boolean },
    list: Transaction[],
  ) => {
    const repo = {
      findAllByAccountUnpaginated: jest.fn(
        (_: string, o?: { startDate?: Date; endDate?: Date }) =>
          Promise.resolve(
            list.filter(
              (t) =>
                (!o?.startDate || t.date >= o.startDate) &&
                (!o?.endDate || t.date <= o.endDate),
            ),
          ),
      ),
    };
    const useCase = new GetAnomaliesUseCase(
      repo as unknown as TransactionRepository,
      {
        findById: jest.fn().mockResolvedValue({
          id: 'per-1',
          accountId,
          startDate: new Date('2026-06-01'),
          ...period,
        }),
      } as unknown as PeriodRepository,
    );
    return { useCase, repo };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15));
  });
  afterEach(() => jest.useRealTimers());

  const dup = (date: string) => [mk('d1', date, -2500), mk('d2', date, -2500)];

  it('detects a duplicate dated after the end of an active period', async () => {
    const { useCase } = build(
      { endDate: new Date('2026-06-30'), isActive: true },
      dup('2026-07-05'),
    );

    const a = await useCase.execute(accountId, 'per-1');

    expect(a.map((x) => x.id)).toEqual(['dup-d1']);
  });

  it('detects a future duplicate of an active period without end (no stop at today)', async () => {
    const { useCase } = build(
      { endDate: null, isActive: true },
      dup('2026-09-10'),
    );

    const a = await useCase.execute(accountId, 'per-1');

    expect(a.map((x) => x.id)).toEqual(['dup-d1']);
  });

  it('closed period: a duplicate dated after the end is not analysed', async () => {
    const { useCase } = build(
      { endDate: new Date('2026-06-30'), isActive: false },
      dup('2026-07-05'),
    );

    expect(await useCase.execute(accountId, 'per-1')).toEqual([]);
  });

  it('a future operation does not enter the comparison history', async () => {
    // 3 dépenses passées de -1000, une cible de -5000, et une dépense future énorme
    // de la même catégorie : sans elle la cible est inhabituelle (moyenne -1000).
    const list = [
      mk('h1', '2026-05-01', -1000),
      mk('h2', '2026-04-01', -1000),
      mk('h3', '2026-03-20', -1000),
      mk('t1', '2026-06-10', -5000),
      mk('future', '2026-09-01', -900000),
    ];
    const { useCase } = build({ endDate: null, isActive: true }, list);

    const a = await useCase.execute(accountId, 'per-1');

    const outliers = a.filter((x) => x.type === 'outlier');
    expect(outliers.map((x) => x.transactionIds[0])).toContain('t1');
    expect(outliers[0].description).toContain('10,00');
  });

  describe('outlier pending dated after the end of the period', () => {
    const history = () => [
      mk('h1', '2026-05-01', -1000),
      mk('h2', '2026-04-01', -1000),
      mk('h3', '2026-03-20', -1000),
    ];
    const outlierIds = (a: { type: string; transactionIds: string[] }[]) =>
      a.filter((x) => x.type === 'outlier').map((x) => x.transactionIds[0]);

    it('flags it on an active period with an end date', async () => {
      const list = [...history(), mk('p1', '2026-07-05', -5000, 'cat-1', true)];
      const { useCase } = build(
        { endDate: new Date('2026-06-30'), isActive: true },
        list,
      );

      expect(outlierIds(await useCase.execute(accountId, 'per-1'))).toEqual([
        'p1',
      ]);
    });

    it('flags it on an active period without end date', async () => {
      const list = [...history(), mk('p1', '2026-09-10', -5000, 'cat-1', true)];
      const { useCase } = build({ endDate: null, isActive: true }, list);

      expect(outlierIds(await useCase.execute(accountId, 'per-1'))).toEqual([
        'p1',
      ]);
    });

    it('does not flag it on a closed period', async () => {
      const list = [...history(), mk('p1', '2026-07-05', -5000, 'cat-1', true)];
      const { useCase } = build(
        { endDate: new Date('2026-06-30'), isActive: false },
        list,
      );

      expect(outlierIds(await useCase.execute(accountId, 'per-1'))).toEqual([]);
    });
  });
});
