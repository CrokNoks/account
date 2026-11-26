import { Test, TestingModule } from '@nestjs/testing';
import { GetCalendarDataUseCase } from './get-calendar-data.use-case';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { RecurringTransaction } from '../../recurring/domain/recurring-transaction.entity';

describe('GetCalendarDataUseCase', () => {
  let useCase: GetCalendarDataUseCase;
  let transactionRepository: jest.Mocked<TransactionRepository>;

  const accountId = 'acc-1';
  const year = 2026;
  const month = 3; // March

  const mockActualTransactions = [
    Transaction.create({
      id: 'tx-1',
      accountId,
      categoryId: 'cat-1',
      date: new Date('2026-03-15'), // March 15
      description: 'Groceries',
      amount: BigInt(-5000),
      reconciled: true,
      pending: false,
      metadata: {},
    }),
  ];

  const mockRecurringTransactions = [
    RecurringTransaction.create({
      id: 'rec-1',
      accountId,
      categoryId: 'cat-2',
      description: 'Internet',
      amount: BigInt(-3000),
      dayOfMonth: 20,
    }),
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCalendarDataUseCase,
        {
          provide: TransactionRepository,
          useValue: {
            findAllByAccountUnpaginated: jest
              .fn()
              .mockResolvedValue(mockActualTransactions),
          },
        },
        {
          provide: RecurringTransactionRepository,
          useValue: {
            findAllByAccount: jest
              .fn()
              .mockResolvedValue(mockRecurringTransactions),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetCalendarDataUseCase>(GetCalendarDataUseCase);
    transactionRepository = module.get(TransactionRepository);
  });

  it('should return actual and projected transactions', async () => {
    // Set "today" to March 1st 2026 for consistent testing
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T09:00:00Z'));

    const result = await useCase.execute(accountId, year, month);

    expect(result).toHaveLength(2); // 1 actual + 1 recurring

    const actual = result.find((e) => e.type === 'actual');
    expect(actual?.description).toBe('Groceries');
    expect(actual?.amount).toBe('-5000');

    const recurring = result.find((e) => e.type === 'recurring');
    expect(recurring?.description).toBe('Internet');
    expect(recurring?.amount).toBe('-3000');
    expect(new Date(recurring!.date).getUTCDate()).toBe(20);

    jest.useRealTimers();
  });

  it('should not project recurring transactions that were already paid', async () => {
    // Set "today" to March 1st 2026
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T09:00:00Z'));

    const paidRecurringDate = new Date('2026-03-20');
    const paidTransaction = Transaction.create({
      accountId,
      categoryId: 'cat-2',
      date: paidRecurringDate,
      description: 'Internet', // Same description as recurring
      amount: BigInt(-3000), // Same amount as recurring
      reconciled: false,
      pending: false,
      metadata: {},
    });

    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue([
      ...mockActualTransactions,
      paidTransaction,
    ]);

    const result = await useCase.execute(accountId, year, month);

    // Should only have 2 "actual" transactions, no "recurring" projected for the 20th
    expect(result.filter((e) => e.type === 'recurring')).toHaveLength(0);
    expect(result.filter((e) => e.type === 'actual')).toHaveLength(2);

    jest.useRealTimers();
  });

  it('projects a day-31 recurring transaction on the last day of a shorter month, once', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-01T09:00:00Z'));
    const findRecurring = (
      useCase as unknown as {
        recurringRepository: { findAllByAccount: jest.Mock };
      }
    ).recurringRepository.findAllByAccount;
    findRecurring.mockResolvedValue([
      RecurringTransaction.create({
        id: 'rec-31',
        accountId,
        categoryId: null,
        description: 'Assurance',
        amount: BigInt(-1000),
        dayOfMonth: 31,
      }),
    ]);

    const result = await useCase.execute(accountId, 2026, 4); // avril : 30 jours

    const projected = result.filter((e) => e.type === 'recurring');
    expect(projected).toHaveLength(1);
    expect(new Date(projected[0].date).getUTCDate()).toBe(30);

    jest.useRealTimers();
  });

  it('projects on the exact calendar days whatever the server time zone', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T09:00:00Z'));

    const result = await useCase.execute(accountId, 2026, 3);

    expect(result.find((e) => e.type === 'recurring')?.date).toBe(
      '2026-03-20T00:00:00.000Z',
    );
    jest.useRealTimers();
  });

  it('marks the pending flag on actual events', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T09:00:00Z'));
    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue([
      mockActualTransactions[0],
      Transaction.create({
        accountId,
        categoryId: null,
        date: new Date('2026-03-25'),
        description: 'Facture eau',
        amount: BigInt(-4000),
        reconciled: false,
        pending: true,
        metadata: {},
      }),
    ]);

    const result = await useCase.execute(accountId, year, month);

    expect(
      result
        .filter((e) => e.type === 'actual')
        .map((e) => [e.description, e.pending]),
    ).toEqual([
      ['Groceries', false],
      ['Facture eau', true],
    ]);
    jest.useRealTimers();
  });

  it('discards the recurring of a future pending transaction with same amount and label', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T09:00:00Z'));
    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue([
      Transaction.create({
        accountId,
        categoryId: 'cat-2',
        date: new Date('2026-03-20'),
        description: 'Internet',
        amount: BigInt(-3000),
        reconciled: false,
        pending: true,
        metadata: {},
      }),
    ]);

    const result = await useCase.execute(accountId, year, month);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'actual', pending: true });
    jest.useRealTimers();
  });

  it('takes the same decision as the cashflow for a recurring paid today', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-20T09:00:00Z'));
    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue([
      Transaction.create({
        accountId,
        categoryId: 'cat-2',
        date: new Date('2026-03-20'),
        description: 'Prélèvement INTERNET',
        amount: BigInt(-3000),
        reconciled: false,
        pending: false,
        metadata: {},
      }),
    ]);

    const result = await useCase.execute(accountId, year, month);

    expect(result.filter((e) => e.type === 'recurring')).toHaveLength(0);
    jest.useRealTimers();
  });

  describe('échéance d’origine', () => {
    const paie = RecurringTransaction.create({
      id: 'r-paie',
      accountId,
      categoryId: 'c-salaire',
      description: 'Salaire',
      amount: BigInt(200000),
      dayOfMonth: 28,
    });
    const loyer = (id = 'r-loyer', dayOfMonth = 30) =>
      RecurringTransaction.create({
        id,
        accountId,
        categoryId: 'c-loyer',
        description: 'Loyer',
        amount: BigInt(-80000),
        dayOfMonth,
      });
    const txOf = (
      id: string,
      date: string,
      over: {
        categoryId?: string | null;
        amount?: number;
        pending?: boolean;
        metadata?: Record<string, unknown>;
      } = {},
    ) =>
      Transaction.create({
        id,
        accountId,
        categoryId:
          over.categoryId === undefined ? 'c-salaire' : over.categoryId,
        date: new Date(date),
        description: 'Virement',
        amount: BigInt(over.amount ?? 200000),
        reconciled: false,
        pending: over.pending ?? false,
        metadata: over.metadata ?? {},
      });
    const setup = (recurrings: RecurringTransaction[], txs: Transaction[]) => {
      (
        useCase as unknown as {
          recurringRepository: { findAllByAccount: jest.Mock };
        }
      ).recurringRepository.findAllByAccount.mockResolvedValue(recurrings);
      transactionRepository.findAllByAccountUnpaginated.mockResolvedValue(txs);
    };
    const projected = (r: { type: string; date: string }[]) =>
      r.filter((e) => e.type === 'recurring').map((e) => e.date.slice(0, 10));

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-11-26T09:00:00Z'));
    });
    afterEach(() => jest.useRealTimers());

    it('CA1 : paie du 28 pointée le 26 : pas de « Prévue » le 28, la transaction du 26 est affichée', async () => {
      setup(
        [paie],
        [
          txOf('t1', '2026-11-26', {
            metadata: { recurringId: 'r-paie', dueDate: '2026-11-28' },
          }),
        ],
      );

      const r = await useCase.execute(accountId, 2026, 11);

      expect(projected(r)).toEqual([]);
      expect(r.filter((e) => e.type === 'actual').map((e) => e.id)).toEqual([
        't1',
      ]);
    });

    it('CA3 : loyer du 30/11 daté 01/12, calendrier de novembre : plus de « Prévue » le 30/11', async () => {
      setup(
        [loyer()],
        [
          txOf('t1', '2026-12-01', {
            categoryId: 'c-loyer',
            amount: -80000,
            metadata: { recurringId: 'r-loyer', dueDate: '2026-11-30' },
          }),
        ],
      );

      const r = await useCase.execute(accountId, 2026, 11);

      expect(projected(r)).toEqual([]);
      // la transaction du 01/12 n'est pas affichée dans novembre
      expect(r.filter((e) => e.type === 'actual')).toEqual([]);
    });

    it('CA3 : une pending future du 30 règle l’échéance, sans doublon « Prévue »', async () => {
      setup(
        [loyer()],
        [
          txOf('t1', '2026-11-30', {
            categoryId: 'c-loyer',
            amount: -80000,
            pending: true,
            metadata: { recurringId: 'r-loyer', dueDate: '2026-11-30' },
          }),
        ],
      );

      const r = await useCase.execute(accountId, 2026, 11);

      expect(projected(r)).toEqual([]);
      expect(r).toHaveLength(1);
    });

    it('CA2 : sans lien à 7 jours règle, à 8 jours non', async () => {
      setup(
        [loyer()],
        [txOf('t1', '2026-11-23', { categoryId: 'c-loyer', amount: -80000 })],
      );
      expect(projected(await useCase.execute(accountId, 2026, 11))).toEqual([]);

      setup(
        [loyer()],
        [txOf('t1', '2026-11-22', { categoryId: 'c-loyer', amount: -80000 })],
      );
      expect(projected(await useCase.execute(accountId, 2026, 11))).toEqual([
        '2026-11-30',
      ]);
    });

    it('une transaction du mois suivant règle l’échéance de fin de mois sans être affichée', async () => {
      setup(
        [loyer()],
        [txOf('t1', '2026-12-04', { categoryId: 'c-loyer', amount: -80000 })],
      );

      const r = await useCase.execute(accountId, 2026, 11);

      expect(projected(r)).toEqual([]);
      expect(r).toEqual([]);
    });

    it('deux loyers à 27 et 30, une transaction sans lien : une seule « Prévue » écartée', async () => {
      setup(
        [loyer('r-a', 27), loyer('r-b', 30)],
        [txOf('t1', '2026-11-28', { categoryId: 'c-loyer', amount: -80000 })],
      );

      const r = await useCase.execute(accountId, 2026, 11);

      expect(projected(r)).toEqual(['2026-11-30']);
    });

    it('lit 31 jours de transactions autour du mois et garde le même résultat que la trésorerie', async () => {
      setup([paie], []);

      await useCase.execute(accountId, 2026, 11);

      expect(
        transactionRepository.findAllByAccountUnpaginated,
      ).toHaveBeenCalledWith(accountId, {
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
      });
    });
  });
});
