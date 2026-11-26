import { BulkDeleteTransactionsUseCase } from './bulk-delete-transactions.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/domain/errors';
import { Transaction } from '../domain/transaction.entity';
import { TransferWriteAccessService } from './transfer-write-access.service';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { AccountShareRepository } from '../../accounts/domain/account-share.repository.interface';
import { Account } from '../../accounts/domain/account.entity';
import { AccountShare } from '../../accounts/domain/account-share.entity';

describe('BulkDeleteTransactionsUseCase', () => {
  let repository: {
    findAllByAccountUnpaginated: jest.Mock;
    findById: jest.Mock;
    findTransferSides: jest.Mock;
    deleteMany: jest.Mock;
    delete: jest.Mock;
  };
  let accounts: { findById: jest.Mock };
  let shares: { findAllByAccount: jest.Mock };
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
      findById: jest.fn(),
      findTransferSides: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    accounts = {
      findById: jest.fn((id: string) =>
        Promise.resolve(new Account({ id, name: id, ownerId: 'user-1' })),
      ),
    };
    shares = { findAllByAccount: jest.fn().mockResolvedValue([]) };
    useCase = new BulkDeleteTransactionsUseCase(
      repository as unknown as TransactionRepository,
      new TransferWriteAccessService(
        accounts as unknown as AccountRepository,
        shares as unknown as AccountShareRepository,
      ),
    );
  });

  it('deletes the requested transactions of the account', async () => {
    await useCase.execute({
      userId: 'user-1',
      accountId: 'acc-1',
      ids: ['t1', 't2'],
    });

    expect(repository.findAllByAccountUnpaginated).toHaveBeenCalledWith(
      'acc-1',
    );
    expect(repository.deleteMany.mock.calls).toEqual([[['t1', 't2']]]);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('answers 404 and deletes nothing when an id does not belong to the account', async () => {
    const result = useCase.execute({
      userId: 'user-1',
      accountId: 'acc-1',
      ids: ['t1', 'foreign'],
    });

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    await expect(result).rejects.toThrow('Transaction not found');
    expect(repository.deleteMany).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('answers 404 when no id belongs to the account', async () => {
    await expect(
      useCase.execute({
        userId: 'user-1',
        accountId: 'acc-1',
        ids: ['foreign'],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.deleteMany).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes a duplicated id only once', async () => {
    await useCase.execute({
      userId: 'user-1',
      accountId: 'acc-1',
      ids: ['t1', 't1'],
    });

    expect(repository.deleteMany.mock.calls).toEqual([[['t1']]]);
  });

  describe('transfers: the other side follows', () => {
    const linked = (
      id: string,
      accountId: string,
      type: 'transfer_out' | 'transfer_in',
      relatedAccountId: string,
      transferId = 'tr-1',
    ) =>
      Transaction.create({
        id,
        accountId,
        categoryId: null,
        date: new Date('2026-11-20'),
        description: 'Virement',
        amount: BigInt(type === 'transfer_out' ? -5000 : 5000),
        reconciled: false,
        pending: false,
        metadata: { transferId, type, relatedAccountId },
      });
    const outA = (id = 'out', transferId = 'tr-1') =>
      linked(id, 'acc-1', 'transfer_out', 'acc-2', transferId);
    const inB = (id = 'in', transferId = 'tr-1') =>
      linked(id, 'acc-2', 'transfer_in', 'acc-1', transferId);
    const foreign = () =>
      accounts.findById.mockImplementation((id: string) =>
        Promise.resolve(
          new Account({
            id,
            name: id,
            ownerId: id === 'acc-2' ? 'someone-else' : 'user-1',
          }),
        ),
      );
    const share = (permission: 'read' | 'write') =>
      new AccountShare({
        accountId: 'acc-2',
        userId: 'user-1',
        permission,
      });

    it('deletes both sides in a single deleteMany when one side is requested', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([outA()]);
      repository.findTransferSides.mockResolvedValue([inB()]);

      await useCase.execute({
        userId: 'user-1',
        accountId: 'acc-1',
        ids: ['out'],
      });

      expect(repository.findTransferSides).toHaveBeenCalledWith(
        'tr-1',
        'acc-2',
      );
      expect(repository.deleteMany.mock.calls).toEqual([[['out', 'in']]]);
    });

    it('adds the other side of a linked line to a batch with ordinary lines', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        tx('t1'),
        outA(),
        tx('t2'),
      ]);
      repository.findTransferSides.mockResolvedValue([inB()]);

      await useCase.execute({
        userId: 'user-1',
        accountId: 'acc-1',
        ids: ['t1', 'out', 't2'],
      });

      expect(repository.deleteMany).toHaveBeenCalledTimes(1);
      expect(
        [...(repository.deleteMany.mock.calls[0] as [string[]])[0]].sort(),
      ).toEqual(['in', 'out', 't1', 't2']);
    });

    it('deletes a line once when a batch holds both sides', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([outA(), inB()]);
      repository.findTransferSides.mockImplementation(
        (_t: string, accountId: string) =>
          Promise.resolve(accountId === 'acc-2' ? [inB()] : [outA()]),
      );

      await useCase.execute({
        userId: 'user-1',
        accountId: 'acc-1',
        ids: ['out', 'in'],
      });

      expect(repository.deleteMany.mock.calls).toEqual([[['out', 'in']]]);
    });

    it('deletes the remaining side of an orphan', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([outA()]);
      repository.findTransferSides.mockResolvedValue([]);

      await useCase.execute({
        userId: 'user-1',
        accountId: 'acc-1',
        ids: ['out'],
      });

      expect(repository.deleteMany.mock.calls).toEqual([[['out']]]);
    });

    it('refuses (403) a batch of 3 lines when one transfer goes to a read-only account: nothing deleted', async () => {
      foreign();
      shares.findAllByAccount.mockResolvedValue([share('read')]);
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        tx('t1'),
        outA(),
        tx('t2'),
      ]);

      await expect(
        useCase.execute({
          userId: 'user-1',
          accountId: 'acc-1',
          ids: ['t1', 'out', 't2'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repository.deleteMany).not.toHaveBeenCalled();
    });

    it('refuses an orphan whose related account is read-only (403)', async () => {
      foreign();
      shares.findAllByAccount.mockResolvedValue([share('read')]);
      repository.findAllByAccountUnpaginated.mockResolvedValue([outA()]);

      await expect(
        useCase.execute({
          userId: 'user-1',
          accountId: 'acc-1',
          ids: ['out'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repository.deleteMany).not.toHaveBeenCalled();
    });

    it('answers 404 (not 403) when the other account is invisible', async () => {
      accounts.findById.mockResolvedValue(null);
      repository.findAllByAccountUnpaginated.mockResolvedValue([outA()]);

      const result = useCase.execute({
        userId: 'user-1',
        accountId: 'acc-1',
        ids: ['out'],
      });

      await expect(result).rejects.toBeInstanceOf(NotFoundError);
      await expect(result).rejects.toThrow('Account not found');
      expect(repository.deleteMany).not.toHaveBeenCalled();
    });

    it('accepts a write share on the other account', async () => {
      foreign();
      shares.findAllByAccount.mockResolvedValue([share('write')]);
      repository.findAllByAccountUnpaginated.mockResolvedValue([outA()]);
      repository.findTransferSides.mockResolvedValue([inB()]);

      await useCase.execute({
        userId: 'user-1',
        accountId: 'acc-1',
        ids: ['out'],
      });

      expect(repository.deleteMany.mock.calls).toEqual([[['out', 'in']]]);
    });

    it('checks the right once per related account', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        outA('o1', 'tr-1'),
        outA('o2', 'tr-2'),
      ]);
      repository.findTransferSides.mockImplementation((transferId: string) =>
        Promise.resolve([inB(transferId === 'tr-1' ? 'i1' : 'i2', transferId)]),
      );

      await useCase.execute({
        userId: 'user-1',
        accountId: 'acc-1',
        ids: ['o1', 'o2'],
      });

      expect(accounts.findById).toHaveBeenCalledTimes(1);
      expect(repository.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('refuses (409) an ambiguous link and deletes nothing, ordinary lines included', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        tx('t1'),
        outA(),
      ]);
      repository.findTransferSides.mockResolvedValue([inB('i1'), inB('i2')]);

      await expect(
        useCase.execute({
          userId: 'user-1',
          accountId: 'acc-1',
          ids: ['t1', 'out'],
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(repository.deleteMany).not.toHaveBeenCalled();
    });

    it('refuses (409) a line with a transferId but no relatedAccountId, nothing deleted, no right check', async () => {
      const broken = Transaction.create({
        id: 'broken',
        accountId: 'acc-1',
        categoryId: null,
        date: new Date('2026-11-20'),
        description: 'Virement',
        amount: BigInt(-5000),
        reconciled: false,
        pending: false,
        metadata: { transferId: 'tr-1', type: 'transfer_out' },
      });
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        tx('t1'),
        broken,
      ]);

      await expect(
        useCase.execute({
          userId: 'user-1',
          accountId: 'acc-1',
          ids: ['t1', 'broken'],
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(accounts.findById).not.toHaveBeenCalled();
      expect(repository.deleteMany).not.toHaveBeenCalled();
    });

    it('does not look at anything else for lines that are not transfers', async () => {
      await useCase.execute({
        userId: 'user-1',
        accountId: 'acc-1',
        ids: ['t1', 't2'],
      });

      expect(accounts.findById).not.toHaveBeenCalled();
      expect(repository.findTransferSides).not.toHaveBeenCalled();
    });
  });

  describe('deleteOne (simple deletion goes through the same rule)', () => {
    it('answers 404 when the transaction belongs to another account', async () => {
      repository.findById.mockResolvedValue(
        Transaction.create({
          id: 'x',
          accountId: 'acc-9',
          categoryId: null,
          date: new Date('2026-03-01'),
          description: 'x',
          amount: BigInt(-1),
          reconciled: false,
          pending: false,
        }),
      );

      await expect(
        useCase.deleteOne({ userId: 'user-1', accountId: 'acc-1', id: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repository.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes both sides of a transfer', async () => {
      const self = Transaction.create({
        id: 'out',
        accountId: 'acc-1',
        categoryId: null,
        date: new Date('2026-11-20'),
        description: 'Virement',
        amount: BigInt(-5000),
        reconciled: false,
        pending: false,
        metadata: {
          transferId: 'tr-1',
          type: 'transfer_out',
          relatedAccountId: 'acc-2',
        },
      });
      const other = Transaction.create({
        id: 'in',
        accountId: 'acc-2',
        categoryId: null,
        date: new Date('2026-11-20'),
        description: 'Virement',
        amount: BigInt(5000),
        reconciled: false,
        pending: false,
        metadata: {
          transferId: 'tr-1',
          type: 'transfer_in',
          relatedAccountId: 'acc-1',
        },
      });
      repository.findById.mockResolvedValue(self);
      repository.findTransferSides.mockResolvedValue([other]);

      await useCase.deleteOne({
        userId: 'user-1',
        accountId: 'acc-1',
        id: 'out',
      });

      expect(repository.deleteMany.mock.calls).toEqual([[['out', 'in']]]);
    });
  });
});
