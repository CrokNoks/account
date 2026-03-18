import { Test, TestingModule } from '@nestjs/testing';
import { GetCalendarDataUseCase } from './get-calendar-data.use-case';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { RecurringTransaction } from '../../recurring/domain/recurring-transaction.entity';
import { getDate } from 'date-fns';

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
      date: new Date(2026, 2, 15), // March 15
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
    jest.useFakeTimers().setSystemTime(new Date(2026, 2, 1));

    const result = await useCase.execute(accountId, year, month);

    expect(result).toHaveLength(2); // 1 actual + 1 recurring

    const actual = result.find((e) => e.type === 'actual');
    expect(actual?.description).toBe('Groceries');
    expect(actual?.amount).toBe('-5000');

    const recurring = result.find((e) => e.type === 'recurring');
    expect(recurring?.description).toBe('Internet');
    expect(recurring?.amount).toBe('-3000');
    expect(getDate(new Date(recurring!.date))).toBe(20);

    jest.useRealTimers();
  });

  it('should not project recurring transactions that were already paid', async () => {
    // Set "today" to March 1st 2026
    jest.useFakeTimers().setSystemTime(new Date(2026, 2, 1));

    const paidRecurringDate = new Date(2026, 2, 20);
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
});
