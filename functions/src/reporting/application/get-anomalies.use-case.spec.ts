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

  it('should ignore small amounts (<5€) and incomes for duplicates', async () => {
    const txSmall1 = Transaction.create({
      id: 'tx-1',
      accountId,
      categoryId: 'cat-1',
      date: new Date(2026, 5, 10),
      description: 'Baguette',
      amount: BigInt(-120),
      metadata: {},
    });
    const txSmall2 = Transaction.create({
      id: 'tx-2',
      accountId,
      categoryId: 'cat-1',
      date: new Date(2026, 5, 10),
      description: 'Baguette',
      amount: BigInt(-120),
      metadata: {},
    });

    const txIncome1 = Transaction.create({
      id: 'tx-3',
      accountId,
      categoryId: 'cat-2',
      date: new Date(2026, 5, 10),
      description: 'Virement',
      amount: BigInt(5000),
      metadata: {},
    });
    const txIncome2 = Transaction.create({
      id: 'tx-4',
      accountId,
      categoryId: 'cat-2',
      date: new Date(2026, 5, 10),
      description: 'Virement',
      amount: BigInt(5000),
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
        metadata: {},
      }),
      Transaction.create({
        id: 'h2',
        accountId,
        categoryId: 'cat-1',
        date: new Date(2026, 3, 1),
        description: 'Test',
        amount: BigInt(-1000),
        metadata: {},
      }),
      Transaction.create({
        id: 'h3',
        accountId,
        categoryId: 'cat-1',
        date: new Date(2026, 4, 1),
        description: 'Test',
        amount: BigInt(-1000),
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
        metadata: { ignoredAnomalies: ['outlier'] },
      }),
      Transaction.create({
        id: 'h1',
        accountId,
        categoryId: 'cat-1',
        date: subMonths(now, 1),
        description: 'H1',
        amount: BigInt(-1000),
      }),
      Transaction.create({
        id: 'h2',
        accountId,
        categoryId: 'cat-1',
        date: subMonths(now, 2),
        description: 'H2',
        amount: BigInt(-1100),
      }),
      Transaction.create({
        id: 'h3',
        accountId,
        categoryId: 'cat-1',
        date: subMonths(now, 3),
        description: 'H3',
        amount: BigInt(-900),
      }),
    ];

    transactionRepository.findAllByAccountUnpaginated.mockResolvedValue(
      transactions,
    );

    const anomalies = await useCase.execute(accountId);

    expect(anomalies).toHaveLength(0);
  });
});
