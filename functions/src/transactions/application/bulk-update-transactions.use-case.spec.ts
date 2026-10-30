import { BulkUpdateTransactionsUseCase } from './bulk-update-transactions.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { DomainValidationError } from '../../shared/domain/errors';

describe('BulkUpdateTransactionsUseCase', () => {
  let repository: { findAllByAccountUnpaginated: jest.Mock; save: jest.Mock };
  let useCase: BulkUpdateTransactionsUseCase;
  let refs: jest.Mocked<AccountReferencesService>;

  const tx = (id: string, overrides: Partial<Transaction> = {}) =>
    Transaction.create({
      id,
      accountId: 'acc-1',
      categoryId: 'cat-old',
      date: new Date('2026-03-01'),
      description: `tx ${id}`,
      amount: BigInt(-100),
      reconciled: false,
      pending: false,
      tagIds: ['tag-old'],
      ...overrides,
    });

  const saved = () =>
    (repository.save.mock.calls as [Transaction][]).map(([t]) => t);

  beforeEach(() => {
    repository = {
      findAllByAccountUnpaginated: jest
        .fn()
        .mockResolvedValue([tx('t1'), tx('t2'), tx('t3')]),
      save: jest.fn().mockResolvedValue(undefined),
    };
    refs = {
      ensureReferences: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccountReferencesService>;
    useCase = new BulkUpdateTransactionsUseCase(
      repository as unknown as TransactionRepository,
      refs,
    );
  });

  it('updates only the requested transactions of the account', async () => {
    await useCase.execute({
      accountId: 'acc-1',
      ids: ['t1', 't3'],
      data: { categoryId: 'cat-new' },
    });

    expect(repository.findAllByAccountUnpaginated).toHaveBeenCalledWith(
      'acc-1',
    );
    expect(saved().map((t) => t.id)).toEqual(['t1', 't3']);
    expect(saved().every((t) => t.categoryId === 'cat-new')).toBe(true);
  });

  it('refuses a category or tags of another account without saving', async () => {
    refs.ensureReferences.mockRejectedValue(
      new DomainValidationError('Category does not belong to this account'),
    );

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        ids: ['t1'],
        data: { categoryId: 'cat-foreign', tagIds: ['tag-foreign'] },
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(refs.ensureReferences).toHaveBeenCalledWith('acc-1', {
      categoryId: 'cat-foreign',
      tagIds: ['tag-foreign'],
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('ignores ids that do not belong to the account', async () => {
    await useCase.execute({
      accountId: 'acc-1',
      ids: ['t1', 'foreign'],
      data: { reconciled: true },
    });

    expect(saved().map((t) => t.id)).toEqual(['t1']);
  });

  it('does nothing when no id belongs to the account', async () => {
    await useCase.execute({
      accountId: 'acc-1',
      ids: ['foreign'],
      data: { reconciled: true },
    });

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('keeps fields that are not provided', async () => {
    await useCase.execute({
      accountId: 'acc-1',
      ids: ['t1'],
      data: { reconciled: true },
    });

    const [t1] = saved();
    expect(t1.reconciled).toBe(true);
    expect(t1.categoryId).toBe('cat-old');
    expect(t1.tagIds).toEqual(['tag-old']);
    expect(t1.pending).toBe(false);
  });

  it('can clear the category with null and replace tags', async () => {
    await useCase.execute({
      accountId: 'acc-1',
      ids: ['t1'],
      data: { categoryId: null, tagIds: ['tag-new'] },
    });

    const [t1] = saved();
    expect(t1.categoryId).toBeNull();
    expect(t1.tagIds).toEqual(['tag-new']);
  });

  // Comportement actuel documenté (docs/transactions.md) : en lot, pointer une
  // transaction ne la sort pas de l'attente, contrairement à la modification simple.
  it('does not reset pending when reconciling in bulk', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      tx('t1', { pending: true }),
    ]);

    await useCase.execute({
      accountId: 'acc-1',
      ids: ['t1'],
      data: { reconciled: true },
    });

    const [t1] = saved();
    expect(t1.reconciled).toBe(true);
    expect(t1.pending).toBe(true);
  });
});
