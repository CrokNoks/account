import { BulkUpdateTransactionsUseCase } from './bulk-update-transactions.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import {
  DomainValidationError,
  NotFoundError,
} from '../../shared/domain/errors';

describe('BulkUpdateTransactionsUseCase', () => {
  let repository: {
    findAllByAccountUnpaginated: jest.Mock;
    updateMany: jest.Mock;
    save: jest.Mock;
  };
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
    (repository.updateMany.mock.calls as [Transaction[]][]).flatMap(
      ([list]) => list,
    );

  beforeEach(() => {
    repository = {
      findAllByAccountUnpaginated: jest
        .fn()
        .mockResolvedValue([tx('t1'), tx('t2'), tx('t3')]),
      updateMany: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
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
    expect(repository.updateMany).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('answers 404 and saves nothing when an id does not belong to the account', async () => {
    const result = useCase.execute({
      accountId: 'acc-1',
      ids: ['t1', 'foreign'],
      data: { reconciled: true },
    });

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    await expect(result).rejects.toThrow('Transaction not found');
    expect(repository.updateMany).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('answers 404 when no id belongs to the account', async () => {
    await expect(
      useCase.execute({
        accountId: 'acc-1',
        ids: ['foreign'],
        data: { reconciled: true },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.updateMany).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('updates a duplicated id only once', async () => {
    await useCase.execute({
      accountId: 'acc-1',
      ids: ['t1', 't1'],
      data: { reconciled: true },
    });

    expect(saved().map((t) => t.id)).toEqual(['t1']);
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

  // Même règle que la modification simple : pointer sort de l'attente.
  it('resets pending when reconciling in bulk', async () => {
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
    expect(t1.pending).toBe(false);
  });

  it('resets pending when reconciling even if pending: true is also provided', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      tx('t1', { pending: true }),
    ]);

    await useCase.execute({
      accountId: 'acc-1',
      ids: ['t1'],
      data: { reconciled: true, pending: true },
    });

    expect(saved()[0].pending).toBe(false);
  });

  it('keeps pending when un-reconciling without providing it', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      tx('t1', { pending: true, reconciled: true }),
    ]);

    await useCase.execute({
      accountId: 'acc-1',
      ids: ['t1'],
      data: { reconciled: false },
    });

    expect(saved()[0].pending).toBe(true);
  });

  it('modifies every target in one atomic call', async () => {
    await useCase.execute({
      accountId: 'acc-1',
      ids: ['t1', 't3'],
      data: { categoryId: 'cat-new' },
    });

    expect(repository.updateMany).toHaveBeenCalledTimes(1);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('propagates the error of the atomic call; no transaction is saved separately', async () => {
    repository.updateMany.mockRejectedValue(new Error('db down'));

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        ids: ['t1', 't3'],
        data: { categoryId: 'cat-new' },
      }),
    ).rejects.toThrow('db down');
    expect(repository.updateMany).toHaveBeenCalledTimes(1);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
