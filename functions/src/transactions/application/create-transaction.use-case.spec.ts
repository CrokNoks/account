import { Test, TestingModule } from '@nestjs/testing';
import { CreateTransactionUseCase, CreateTransactionCommand } from './create-transaction.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';

describe('CreateTransactionUseCase', () => {
  let useCase: CreateTransactionUseCase;
  let repository: TransactionRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTransactionUseCase,
        {
          provide: TransactionRepository,
          useValue: {
            save: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get<CreateTransactionUseCase>(CreateTransactionUseCase);
    repository = module.get<TransactionRepository>(TransactionRepository);
  });

  it('should create and save a new transaction', async () => {
    const command: CreateTransactionCommand = {
      accountId: 'acc-1',
      categoryId: 'cat-1',
      date: new Date(),
      description: 'Coffee',
      amount: BigInt(-350),
    };

    const result = await useCase.execute(command);

    expect(result.id).toBeDefined();
    expect(result.description).toBe('Coffee');
    expect(repository.save).toHaveBeenCalled();
  });
});
