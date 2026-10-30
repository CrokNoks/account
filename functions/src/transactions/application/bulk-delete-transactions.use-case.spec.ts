import { BulkDeleteTransactionsUseCase } from './bulk-delete-transactions.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';

describe('BulkDeleteTransactionsUseCase', () => {
  let repository: { findAllByAccountUnpaginated: jest.Mock; delete: jest.Mock };
  let useCase: BulkDeleteTransactionsUseCase;

  const tx = (id: string) =>
    Transaction.create({
      id,
      accountId: 'acc-1',
      categoryId: null,
      date: new Date('2026-03-01'),
      description: `tx ${id}`,
      amount: BigInt(-100),
      reconciled: false,
      pending: false,
    });

  beforeEach(() => {
    repository = {
      findAllByAccountUnpaginated: jest
        .fn()
        .mockResolvedValue([tx('t1'), tx('t2')]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new BulkDeleteTransactionsUseCase(
      repository as unknown as TransactionRepository,
    );
  });

  it('deletes the requested transactions of the account', async () => {
    await useCase.execute({ accountId: 'acc-1', ids: ['t1', 't2'] });

    expect(repository.findAllByAccountUnpaginated).toHaveBeenCalledWith(
      'acc-1',
    );
    expect(repository.delete.mock.calls).toEqual([['t1'], ['t2']]);
  });

  it('never deletes ids that do not belong to the account', async () => {
    await useCase.execute({ accountId: 'acc-1', ids: ['t1', 'foreign'] });

    expect(repository.delete.mock.calls).toEqual([['t1']]);
  });

  it('does nothing when no id belongs to the account', async () => {
    await useCase.execute({ accountId: 'acc-1', ids: ['foreign'] });

    expect(repository.delete).not.toHaveBeenCalled();
  });
});
