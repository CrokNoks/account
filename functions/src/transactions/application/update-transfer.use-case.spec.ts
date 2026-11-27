import { UpdateTransferUseCase } from './update-transfer.use-case';
import { TransferWriteAccessService } from './transfer-write-access.service';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { AccountShareRepository } from '../../accounts/domain/account-share.repository.interface';
import { Account } from '../../accounts/domain/account.entity';
import { AccountShare } from '../../accounts/domain/account-share.entity';
import {
  ConflictError,
  DomainValidationError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/domain/errors';

const side = (
  id: string,
  accountId: string,
  type: 'transfer_out' | 'transfer_in',
  relatedAccountId: string,
  amount: number,
  overrides: Partial<Parameters<typeof Transaction.create>[0]> = {},
) =>
  Transaction.create({
    id,
    accountId,
    categoryId: null,
    date: new Date('2026-11-20'),
    description: 'Virement',
    amount: BigInt(amount),
    reconciled: false,
    pending: false,
    metadata: { transferId: 'tr-1', type, relatedAccountId },
    ...overrides,
  });

const outSide = () => side('out', 'A', 'transfer_out', 'B', -5000);
const inSide = () => side('in', 'B', 'transfer_in', 'A', 5000);

describe('UpdateTransferUseCase', () => {
  let repository: {
    findTransferSides: jest.Mock;
    updateMany: jest.Mock;
    save: jest.Mock;
    findById: jest.Mock;
  };
  let accounts: { findById: jest.Mock };
  let shares: { findAllByAccount: jest.Mock };
  let useCase: UpdateTransferUseCase;

  const run = (existing: Transaction, changes: Partial<Transaction>) =>
    useCase.execute({
      userId: 'user-1',
      existing,
      updated: existing.update(changes),
    });

  beforeEach(() => {
    repository = {
      findTransferSides: jest.fn(),
      updateMany: jest.fn().mockResolvedValue(undefined),
      save: jest.fn((t: Transaction) => Promise.resolve(t)),
      findById: jest.fn((id: string) =>
        Promise.resolve(id === 'out' ? outSide() : inSide()),
      ),
    };
    accounts = {
      findById: jest.fn((id: string) =>
        Promise.resolve(new Account({ id, name: id, ownerId: 'user-1' })),
      ),
    };
    shares = { findAllByAccount: jest.fn().mockResolvedValue([]) };
    useCase = new UpdateTransferUseCase(
      repository as unknown as TransactionRepository,
      new TransferWriteAccessService(
        accounts as unknown as AccountRepository,
        shares as unknown as AccountShareRepository,
      ),
    );
  });

  const writtenPair = () => {
    expect(repository.updateMany).toHaveBeenCalledTimes(1);
    const [lines] = repository.updateMany.mock.calls[0] as [Transaction[]];
    expect(lines).toHaveLength(2);
    return lines;
  };

  describe('amount and date follow the other side', () => {
    it('-5000/+5000: changing the outgoing side to -8000 writes -8000/+8000 in one updateMany', async () => {
      repository.findTransferSides.mockResolvedValue([inSide()]);

      await run(outSide(), { amount: BigInt(-8000) });

      const [self, other] = writtenPair();
      expect(self.id).toBe('out');
      expect(self.amount).toBe(BigInt(-8000));
      expect(other.id).toBe('in');
      expect(other.amount).toBe(BigInt(8000));
      expect(repository.save).not.toHaveBeenCalled();
      expect(repository.findTransferSides).toHaveBeenCalledWith('tr-1', 'B');
    });

    it('from the incoming side (+8000) the outgoing side becomes -8000', async () => {
      repository.findTransferSides.mockResolvedValue([outSide()]);

      await run(inSide(), { amount: BigInt(8000) });

      const [self, other] = writtenPair();
      expect(self.amount).toBe(BigInt(8000));
      expect(other.id).toBe('out');
      expect(other.amount).toBe(BigInt(-8000));
    });

    it('a new date goes to the other side', async () => {
      repository.findTransferSides.mockResolvedValue([inSide()]);

      await run(outSide(), { date: new Date('2026-11-22') });

      const [self, other] = writtenPair();
      expect(self.date).toEqual(new Date('2026-11-22'));
      expect(other.date).toEqual(new Date('2026-11-22'));
      expect(other.amount).toBe(BigInt(5000));
    });

    it('keeps the own fields of the other side (reconciled, pending, notes, tags)', async () => {
      const reconciledIn = inSide().update({
        reconciled: true,
        notes: 'note B',
        tagIds: ['t1'],
      });
      repository.findTransferSides.mockResolvedValue([reconciledIn]);

      await run(outSide(), { amount: BigInt(-8000) });

      const [, other] = writtenPair();
      expect(other.amount).toBe(BigInt(8000));
      expect(other.reconciled).toBe(true);
      expect(other.pending).toBe(false);
      expect(other.notes).toBe('note B');
      expect(other.tagIds).toEqual(['t1']);
    });

    it('returns the modified side as stored', async () => {
      repository.findTransferSides.mockResolvedValue([inSide()]);
      const stored = outSide().update({ amount: BigInt(-8000) });
      repository.findById.mockResolvedValue(stored);

      const result = await run(outSide(), { amount: BigInt(-8000) });

      expect(result).toBe(stored);
    });
  });

  describe('refused amounts (400), nothing read nor written', () => {
    it.each([BigInt(8000), BigInt(0)])(
      'outgoing side to %s',
      async (amount) => {
        await expect(run(outSide(), { amount })).rejects.toBeInstanceOf(
          DomainValidationError,
        );
        expect(accounts.findById).not.toHaveBeenCalled();
        expect(repository.findTransferSides).not.toHaveBeenCalled();
        expect(repository.updateMany).not.toHaveBeenCalled();
        expect(repository.save).not.toHaveBeenCalled();
      },
    );

    it.each([BigInt(-1), BigInt(0)])('incoming side to %s', async (amount) => {
      await expect(run(inSide(), { amount })).rejects.toBeInstanceOf(
        DomainValidationError,
      );
      expect(accounts.findById).not.toHaveBeenCalled();
      expect(repository.updateMany).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('write access to the other account', () => {
    const foreign = () =>
      accounts.findById.mockImplementation((id: string) =>
        Promise.resolve(
          new Account({
            id,
            name: id,
            ownerId: id === 'B' ? 'someone-else' : 'user-1',
          }),
        ),
      );
    const share = (permission: 'read' | 'write') =>
      new AccountShare({ accountId: 'B', userId: 'user-1', permission });

    it('refuses (403) a read share and writes nothing, not even the own side', async () => {
      foreign();
      shares.findAllByAccount.mockResolvedValue([share('read')]);

      await expect(
        run(outSide(), { amount: BigInt(-8000) }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repository.updateMany).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('refuses (403) when the caller has no share', async () => {
      foreign();

      await expect(
        run(outSide(), { date: new Date('2026-11-22') }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repository.updateMany).not.toHaveBeenCalled();
    });

    it('answers 404, not 403, when the other account is invisible', async () => {
      accounts.findById.mockResolvedValue(null);

      const result = run(outSide(), { amount: BigInt(-8000) });

      await expect(result).rejects.toBeInstanceOf(NotFoundError);
      await expect(result).rejects.toThrow('Account not found');
      expect(repository.updateMany).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('accepts a write share', async () => {
      foreign();
      shares.findAllByAccount.mockResolvedValue([share('write')]);
      repository.findTransferSides.mockResolvedValue([inSide()]);

      await run(outSide(), { amount: BigInt(-8000) });

      expect(repository.updateMany).toHaveBeenCalledTimes(1);
    });

    it('accepts the owner of the other account', async () => {
      repository.findTransferSides.mockResolvedValue([inSide()]);

      await run(outSide(), { amount: BigInt(-8000) });

      expect(repository.updateMany).toHaveBeenCalledTimes(1);
    });

    it('also refuses (403) an orphan whose related account is read-only', async () => {
      foreign();
      shares.findAllByAccount.mockResolvedValue([share('read')]);
      repository.findTransferSides.mockResolvedValue([]);

      await expect(
        run(outSide(), { amount: BigInt(-8000) }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('all or nothing', () => {
    it.each([
      ['RLS refusal', new ForbiddenError('denied')],
      ['transaction vanished', new NotFoundError('Transaction not found')],
    ])('propagates the error when updateMany fails (%s)', async (_n, error) => {
      repository.findTransferSides.mockResolvedValue([inSide()]);
      repository.updateMany.mockRejectedValue(error);

      await expect(run(outSide(), { amount: BigInt(-8000) })).rejects.toBe(
        error,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('changes that never reach the other side', () => {
    it('saves only the own side, reads nothing and checks no right, when neither amount nor date changes', async () => {
      accounts.findById.mockResolvedValue(null);

      await run(outSide(), {
        description: 'Autre libellé',
        notes: 'n',
        reconciled: true,
        tagIds: ['t1'],
      });

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.updateMany).not.toHaveBeenCalled();
      expect(repository.findTransferSides).not.toHaveBeenCalled();
      expect(accounts.findById).not.toHaveBeenCalled();
    });

    it('treats the same amount and the same date as no change', async () => {
      accounts.findById.mockResolvedValue(null);

      await run(outSide(), {
        amount: BigInt(-5000),
        date: new Date('2026-11-20'),
      });

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.updateMany).not.toHaveBeenCalled();
      expect(accounts.findById).not.toHaveBeenCalled();
    });
  });

  describe('orphan (other side missing)', () => {
    it('modifies only the remaining side when the related account is writable', async () => {
      repository.findTransferSides.mockResolvedValue([]);

      await run(outSide(), { amount: BigInt(-8000) });

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('ambiguous link (409), nothing written', () => {
    it('two candidate lines', async () => {
      repository.findTransferSides.mockResolvedValue([inSide(), inSide()]);

      await expect(
        run(outSide(), { amount: BigInt(-8000) }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(repository.updateMany).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('one candidate of the same type', async () => {
      repository.findTransferSides.mockResolvedValue([
        side('x', 'B', 'transfer_out', 'A', -5000),
      ]);

      await expect(
        run(outSide(), { amount: BigInt(-8000) }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(repository.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('invalid link on the line (409, no right check, nothing written)', () => {
    it.each([
      ['no relatedAccountId', { transferId: 'tr-1', type: 'transfer_out' }],
      [
        'invalid type',
        { transferId: 'tr-1', type: 'x', relatedAccountId: 'B' },
      ],
    ])('%s', async (_n, metadata) => {
      const broken = outSide().update({ metadata });

      await expect(
        run(broken, { amount: BigInt(-8000) }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(accounts.findById).not.toHaveBeenCalled();
      expect(repository.findTransferSides).not.toHaveBeenCalled();
      expect(repository.updateMany).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('metadata', () => {
    const withMetadata = (metadata: Record<string, unknown>) =>
      run(outSide(), { metadata });

    it.each([
      [
        'removing the transferId',
        { type: 'transfer_out', relatedAccountId: 'B' },
      ],
      [
        'changing the type',
        { transferId: 'tr-1', type: 'transfer_in', relatedAccountId: 'B' },
      ],
      [
        'changing the related account',
        { transferId: 'tr-1', type: 'transfer_out', relatedAccountId: 'C' },
      ],
    ])(
      'refuses (400) %s, even without amount or date',
      async (_n, metadata) => {
        await expect(withMetadata(metadata)).rejects.toBeInstanceOf(
          DomainValidationError,
        );
        expect(repository.save).not.toHaveBeenCalled();
        expect(repository.updateMany).not.toHaveBeenCalled();
      },
    );

    it('accepts another key while keeping the link', async () => {
      await withMetadata({
        transferId: 'tr-1',
        type: 'transfer_out',
        relatedAccountId: 'B',
        label: 'x',
      });

      expect(repository.save).toHaveBeenCalledTimes(1);
    });
  });
});
