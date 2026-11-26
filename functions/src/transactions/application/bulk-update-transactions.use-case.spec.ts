import { BulkUpdateTransactionsUseCase } from './bulk-update-transactions.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { ApplyPeriodSwitchService } from '../../periods/application/apply-period-switch.service';
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
  let periodSwitch: { process: jest.Mock };

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
    periodSwitch = {
      process: jest.fn((request: { transactions: unknown[] }) =>
        Promise.resolve({
          transactions: request.transactions,
          written: false,
          periodSwitch: null,
        }),
      ),
    };
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
      periodSwitch as unknown as ApplyPeriodSwitchService,
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

  describe('keeps the due date of a recurring transaction (metadata.dueDate)', () => {
    const redated = (pending: boolean) =>
      tx('t1', {
        pending,
        date: new Date('2026-12-01'),
        metadata: { source: 'recurring', dueDate: '2026-11-30' },
      });

    it('on a category change', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        redated(false),
      ]);

      await useCase.execute({
        accountId: 'acc-1',
        ids: ['t1'],
        data: { categoryId: 'cat-new' },
      });

      expect(saved()[0].metadata).toEqual({
        source: 'recurring',
        dueDate: '2026-11-30',
      });
    });

    it('when a pending transaction is ticked off (the date moves, the due date stays)', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([redated(true)]);

      await useCase.execute({
        accountId: 'acc-1',
        ids: ['t1'],
        data: { reconciled: true },
      });

      expect(saved()[0]).toMatchObject({
        pending: false,
        reconciled: true,
        date: new Date('2026-12-01'),
        metadata: { source: 'recurring', dueDate: '2026-11-30' },
      });
    });
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

  it('P5 : refuses reconciled and pending both true in the body, writes nothing', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      tx('t1', { pending: true }),
    ]);

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        ids: ['t1'],
        data: { reconciled: true, pending: true },
      }),
    ).rejects.toThrow(DomainValidationError);
    expect(repository.updateMany).not.toHaveBeenCalled();
    expect(periodSwitch.process).not.toHaveBeenCalled();
  });

  it('P3 : refuses pending: true on a reconciled transaction', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      tx('t1', { reconciled: true }),
    ]);

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        ids: ['t1'],
        data: { pending: true },
      }),
    ).rejects.toThrow(DomainValidationError);
    expect(repository.updateMany).not.toHaveBeenCalled();
  });

  it('P6 : un-reconciling and setting pending in the same body is allowed', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      tx('t1', { reconciled: true }),
    ]);

    await useCase.execute({
      accountId: 'acc-1',
      ids: ['t1'],
      data: { reconciled: false, pending: true },
    });

    expect(saved()[0]).toMatchObject({ reconciled: false, pending: true });
  });

  it('P7 : one invalid line out of three makes the whole batch fail, nothing is written', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      tx('t1'),
      tx('t2', { reconciled: true }),
      tx('t3'),
    ]);

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        ids: ['t1', 't2', 't3'],
        data: { pending: true },
      }),
    ).rejects.toThrow(DomainValidationError);
    expect(repository.updateMany).not.toHaveBeenCalled();
    expect(periodSwitch.process).not.toHaveBeenCalled();
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

  describe('leaving pending (period trigger)', () => {
    it('tells the switch service which transactions leave pending, only pending to not pending', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        tx('t1', { pending: true }),
        tx('t2', { pending: false }),
        tx('t3', { pending: true }),
      ]);

      await useCase.execute({
        accountId: 'acc-1',
        ids: ['t1', 't2', 't3'],
        data: { pending: false },
      });

      const request = (
        periodSwitch.process.mock.calls as unknown[][]
      )[0][0] as {
        mode: string;
        leavingPendingIds: Set<string>;
      };
      expect(request.mode).toBe('update');
      expect([...request.leavingPendingIds].sort()).toEqual(['t1', 't3']);
    });

    it('counts pointing (reconciled) as leaving pending, and putting back to pending as not leaving', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        tx('t1', { pending: true }),
        tx('t2', { pending: false }),
      ]);

      await useCase.execute({
        accountId: 'acc-1',
        ids: ['t1'],
        data: { reconciled: true },
      });
      await useCase.execute({
        accountId: 'acc-1',
        ids: ['t2'],
        data: { pending: true },
      });

      const first = (periodSwitch.process.mock.calls as unknown[][])[0][0] as {
        leavingPendingIds: Set<string>;
      };
      const second = (periodSwitch.process.mock.calls as unknown[][])[1][0] as {
        leavingPendingIds: Set<string>;
      };
      expect([...first.leavingPendingIds]).toEqual(['t1']);
      expect(second.leavingPendingIds.size).toBe(0);
    });

    it('writes with updateMany the transactions returned by the service when it did not write', async () => {
      const rewritten = tx('t1', { date: new Date('2026-12-01') });
      periodSwitch.process.mockResolvedValue({
        transactions: [rewritten],
        written: false,
        periodSwitch: null,
      });

      const result = await useCase.execute({
        accountId: 'acc-1',
        ids: ['t1'],
        data: { pending: false },
      });

      expect(repository.updateMany).toHaveBeenCalledWith([rewritten]);
      expect(result.periodSwitch).toBeNull();
    });

    it('does not call updateMany when the switch wrote everything atomically, and returns the switch', async () => {
      const info = {
        closed: { id: 'p1', startDate: '2026-10-01', endDate: '2026-11-30' },
        opened: { id: 'p2', startDate: '2026-12-01', endDate: '2026-12-27' },
        count: 1,
        dateChanged: true,
      };
      periodSwitch.process.mockResolvedValue({
        transactions: [tx('t1')],
        written: true,
        periodSwitch: info,
      });

      const result = await useCase.execute({
        accountId: 'acc-1',
        ids: ['t1'],
        data: { pending: false },
      });

      expect(repository.updateMany).not.toHaveBeenCalled();
      expect(result.periodSwitch).toBe(info);
    });
  });
});
