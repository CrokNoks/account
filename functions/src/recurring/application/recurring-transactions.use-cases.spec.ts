import { NotFoundError } from '../../shared/domain/errors';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { DomainValidationError } from '../../shared/domain/errors';
import { CreateRecurringTransactionUseCase } from './create-recurring-transaction.use-case';
import { DeleteRecurringTransactionUseCase } from './delete-recurring-transaction.use-case';
import { GetRecurringTransactionsUseCase } from './get-recurring-transactions.use-case';
import { UpdateRecurringTransactionUseCase } from './update-recurring-transaction.use-case';
import { RecurringTransactionRepository } from '../domain/recurring-transaction.repository.interface';
import { RecurringTransaction } from '../domain/recurring-transaction.entity';

describe('Recurring transactions use cases', () => {
  let repository: jest.Mocked<RecurringTransactionRepository>;
  let refs: jest.Mocked<AccountReferencesService>;

  const existing = RecurringTransaction.create({
    id: 'rec-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    description: 'Loyer',
    amount: BigInt(-85000),
    dayOfMonth: 5,
    createdAt: new Date('2026-01-01'),
  });

  beforeEach(() => {
    repository = {
      findAllByAccount: jest.fn(),
      findById: jest.fn().mockResolvedValue(existing),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    refs = {
      ensureCategories: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccountReferencesService>;
  });

  it('creates and saves a recurring transaction', async () => {
    const created = await new CreateRecurringTransactionUseCase(
      repository,
      refs,
    ).execute({
      accountId: 'acc-1',
      categoryId: null,
      description: 'Netflix',
      amount: BigInt(-1399),
      dayOfMonth: 12,
    });

    expect(created).toMatchObject({
      accountId: 'acc-1',
      description: 'Netflix',
      amount: BigInt(-1399),
      dayOfMonth: 12,
    });
    expect(repository.save).toHaveBeenCalledWith(created);
  });

  it('refuses a category of another account without saving', async () => {
    refs.ensureCategories.mockRejectedValue(
      new DomainValidationError('Category does not belong to this account'),
    );

    await expect(
      new CreateRecurringTransactionUseCase(repository, refs).execute({
        accountId: 'acc-1',
        categoryId: 'cat-foreign',
        description: 'Netflix',
        amount: BigInt(-1399),
        dayOfMonth: 12,
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not save an invalid recurring transaction', async () => {
    await expect(
      new CreateRecurringTransactionUseCase(repository, refs).execute({
        accountId: 'acc-1',
        categoryId: null,
        description: 'Netflix',
        amount: BigInt(-1399),
        dayOfMonth: 0,
      }),
    ).rejects.toThrow('Day of month must be between 1 and 31');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('lists the recurring transactions of an account', async () => {
    repository.findAllByAccount.mockResolvedValue([existing]);

    expect(
      await new GetRecurringTransactionsUseCase(repository).execute('acc-1'),
    ).toEqual([existing]);
    expect(repository.findAllByAccount).toHaveBeenCalledWith('acc-1');
  });

  describe('DeleteRecurringTransactionUseCase', () => {
    const useCase = () => new DeleteRecurringTransactionUseCase(repository);

    it('deletes a recurring transaction of the account', async () => {
      await useCase().execute('acc-1', 'rec-1');

      expect(repository.delete).toHaveBeenCalledWith('rec-1');
    });

    it.each([
      ['another account', existing],
      ['nobody', null],
    ])(
      'throws NotFoundError without deleting when it belongs to %s',
      async (_, found) => {
        repository.findById.mockResolvedValue(found);

        await expect(
          useCase().execute('acc-other', 'rec-1'),
        ).rejects.toBeInstanceOf(NotFoundError);
        expect(repository.delete).not.toHaveBeenCalled();
      },
    );
  });

  describe('UpdateRecurringTransactionUseCase', () => {
    const useCase = () =>
      new UpdateRecurringTransactionUseCase(repository, refs);

    it('merges the provided fields and keeps identity', async () => {
      const updated = await useCase().execute('acc-1', 'rec-1', {
        amount: BigInt(-90000),
        dayOfMonth: 1,
      });

      expect(updated).toMatchObject({
        id: 'rec-1',
        accountId: 'acc-1',
        description: 'Loyer',
        amount: BigInt(-90000),
        dayOfMonth: 1,
        createdAt: new Date('2026-01-01'),
      });
      expect(repository.save).toHaveBeenCalledWith(updated);
    });

    it('rejects a category of another account without saving', async () => {
      refs.ensureCategories.mockRejectedValue(
        new DomainValidationError('Category does not belong to this account'),
      );

      await expect(
        useCase().execute('acc-1', 'rec-1', { categoryId: 'cat-foreign' }),
      ).rejects.toBeInstanceOf(DomainValidationError);
      expect(refs.ensureCategories).toHaveBeenCalledWith('acc-1', [
        'cat-foreign',
      ]);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects an unknown recurring transaction', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(useCase().execute('acc-1', 'nope', {})).rejects.toThrow(
        'Recurring transaction not found',
      );
      await expect(
        useCase().execute('acc-1', 'nope', {}),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a recurring transaction of another account without saving', async () => {
      await expect(
        useCase().execute('acc-other', 'rec-1', { dayOfMonth: 1 }),
      ).rejects.toThrow('Recurring transaction not found');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('validates the merged result', async () => {
      await expect(
        useCase().execute('acc-1', 'rec-1', { dayOfMonth: 40 }),
      ).rejects.toThrow('Day of month must be between 1 and 31');
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
