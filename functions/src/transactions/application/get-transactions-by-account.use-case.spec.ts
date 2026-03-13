import { Test, TestingModule } from '@nestjs/testing';
import { GetTransactionsByAccountUseCase } from './get-transactions-by-account.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';

describe('GetTransactionsByAccountUseCase', () => {
  let useCase: GetTransactionsByAccountUseCase;
  let repository: jest.Mocked<TransactionRepository>;

  const mockTransactions = [
    Transaction.create({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      date: new Date(),
      description: 'T1',
      amount: BigInt(-1000),
      reconciled: false,
      pending: false,
      metadata: {},
    }),
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTransactionsByAccountUseCase,
        {
          provide: TransactionRepository,
          useValue: {
            findAllByAccount: jest.fn().mockResolvedValue(mockTransactions),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetTransactionsByAccountUseCase>(
      GetTransactionsByAccountUseCase,
    );
    repository = module.get<TransactionRepository>(
      TransactionRepository,
    ) as jest.Mocked<TransactionRepository>;
  });

  it('should return transactions for an account', async () => {
    const result = await useCase.execute('acc-1');
    expect(result).toEqual(mockTransactions);
    expect(repository.findAllByAccount).toHaveBeenCalledWith(
      'acc-1',
      undefined,
    );
  });

  it('should pass options to repository', async () => {
    const options = { search: 'test' };
    await useCase.execute('acc-1', options);
    expect(repository.findAllByAccount).toHaveBeenCalledWith('acc-1', options);
  });
});
