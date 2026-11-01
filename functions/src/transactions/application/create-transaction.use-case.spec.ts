import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateTransactionUseCase,
  CreateTransactionCommand,
} from './create-transaction.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { DomainValidationError } from '../../shared/domain/errors';

describe('CreateTransactionUseCase', () => {
  let useCase: CreateTransactionUseCase;
  let repository: jest.Mocked<TransactionRepository>;
  let refs: { ensureReferences: jest.Mock };

  beforeEach(async () => {
    refs = { ensureReferences: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTransactionUseCase,
        { provide: AccountReferencesService, useValue: refs },
        {
          provide: TransactionRepository,
          useValue: {
            save: jest.fn((t: unknown) => Promise.resolve(t)),
          },
        },
      ],
    }).compile();

    useCase = module.get<CreateTransactionUseCase>(CreateTransactionUseCase);
    repository = module.get<TransactionRepository>(
      TransactionRepository,
    ) as jest.Mocked<TransactionRepository>;
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

  it('refuses references of another account without saving', async () => {
    refs.ensureReferences.mockRejectedValue(
      new DomainValidationError('Category does not belong to this account'),
    );

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        categoryId: 'cat-foreign',
        tagIds: ['tag-foreign'],
        date: new Date(),
        description: 'Coffee',
        amount: BigInt(-350),
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(refs.ensureReferences).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({
        categoryId: 'cat-foreign',
        tagIds: ['tag-foreign'],
      }),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
});
