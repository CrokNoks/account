import { Test, TestingModule } from '@nestjs/testing';
import { GetTransactionsByAccountUseCase } from './get-transactions-by-account.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';

describe('GetTransactionsByAccountUseCase', () => {
  let useCase: GetTransactionsByAccountUseCase;
  let repository: TransactionRepository;

  const mockTransactions = [
    Transaction.create({ accountId: 'acc-1', categoryId: 'cat-1', date: new Date(), description: 'T1', amount: BigInt(-1000) }),
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

    useCase = module.get<GetTransactionsByAccountUseCase>(GetTransactionsByAccountUseCase);
    repository = module.get<TransactionRepository>(TransactionRepository);
  });

  it('should return transactions for an account', async () => {
    const result = await useCase.execute('acc-1');
    expect(result).toEqual(mockTransactions);
    expect(repository.findAllByAccount).toHaveBeenCalledWith('acc-1');
  });
});
