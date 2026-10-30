import { CreateTransferUseCase } from './create-transfer.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { AccountShareRepository } from '../../accounts/domain/account-share.repository.interface';
import { Account } from '../../accounts/domain/account.entity';
import { AccountShare } from '../../accounts/domain/account-share.entity';
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors';

describe('CreateTransferUseCase', () => {
  let repository: jest.Mocked<Pick<TransactionRepository, 'save'>>;
  let accounts: { findById: jest.Mock };
  let shares: { findAllByAccount: jest.Mock };
  let useCase: CreateTransferUseCase;

  const command = {
    userId: 'user-1',
    sourceAccountId: 'acc-src',
    destinationAccountId: 'acc-dst',
    amount: BigInt(15000),
    date: new Date('2026-03-01'),
    description: 'Épargne mensuelle',
  };

  beforeEach(() => {
    repository = { save: jest.fn().mockResolvedValue(undefined) };
    accounts = {
      findById: jest
        .fn()
        .mockResolvedValue(
          new Account({ id: 'acc-dst', name: 'D', ownerId: 'user-1' }),
        ),
    };
    shares = { findAllByAccount: jest.fn().mockResolvedValue([]) };
    useCase = new CreateTransferUseCase(
      repository as unknown as TransactionRepository,
      accounts as unknown as AccountRepository,
      shares as unknown as AccountShareRepository,
    );
  });

  it('debits the source and credits the destination with the same amount', async () => {
    const [out, into] = await useCase.execute(command);

    expect(out.accountId).toBe('acc-src');
    expect(out.amount).toBe(BigInt(-15000));
    expect(into.accountId).toBe('acc-dst');
    expect(into.amount).toBe(BigInt(15000));
    expect(out.amount + into.amount).toBe(BigInt(0));
  });

  it('links both sides with a shared transferId and the related account', async () => {
    const [out, into] = await useCase.execute(command);

    expect(out.metadata?.transferId).toBeDefined();
    expect(out.metadata?.transferId).toBe(into.metadata?.transferId);
    expect(out.metadata).toMatchObject({
      type: 'transfer_out',
      relatedAccountId: 'acc-dst',
    });
    expect(into.metadata).toMatchObject({
      type: 'transfer_in',
      relatedAccountId: 'acc-src',
    });
  });

  it('creates uncategorized, unreconciled, non-pending transactions with the given date and description', async () => {
    const [out, into] = await useCase.execute(command);

    for (const tx of [out, into]) {
      expect(tx.categoryId).toBeNull();
      expect(tx.reconciled).toBe(false);
      expect(tx.pending).toBe(false);
      expect(tx.date).toEqual(command.date);
      expect(tx.description).toBe('Épargne mensuelle');
    }
  });

  it('saves both transactions', async () => {
    const [out, into] = await useCase.execute(command);

    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(repository.save).toHaveBeenNthCalledWith(1, out);
    expect(repository.save).toHaveBeenNthCalledWith(2, into);
  });

  it.each([BigInt(0), BigInt(-100)])(
    'rejects a non strictly positive amount (%s)',
    async (amount) => {
      await expect(useCase.execute({ ...command, amount })).rejects.toThrow(
        'Transfer amount must be strictly positive',
      );
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it('rejects a transfer to the same account', async () => {
    await expect(
      useCase.execute({ ...command, destinationAccountId: 'acc-src' }),
    ).rejects.toThrow('Source and destination accounts must be different');
    expect(repository.save).not.toHaveBeenCalled();
  });

  describe('destination account access', () => {
    const foreign = () =>
      accounts.findById.mockResolvedValue(
        new Account({ id: 'acc-dst', name: 'D', ownerId: 'someone-else' }),
      );
    const share = (userId: string, permission: 'read' | 'write') =>
      new AccountShare({ accountId: 'acc-dst', userId, permission });

    it('refuses (404) an unknown or inaccessible destination, without saving', async () => {
      accounts.findById.mockResolvedValue(null);

      await expect(useCase.execute(command)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('refuses (403) a destination shared in read only, without saving', async () => {
      foreign();
      shares.findAllByAccount.mockResolvedValue([share('user-1', 'read')]);

      await expect(useCase.execute(command)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('refuses (403) when no share belongs to the caller', async () => {
      foreign();
      shares.findAllByAccount.mockResolvedValue([share('other', 'write')]);

      await expect(useCase.execute(command)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('accepts a destination shared in write', async () => {
      foreign();
      shares.findAllByAccount.mockResolvedValue([share('user-1', 'write')]);

      await useCase.execute(command);
      expect(repository.save).toHaveBeenCalledTimes(2);
    });
  });

  // Comportement actuel documenté (docs/transactions.md) : le virement n'est pas atomique.
  it('leaves the debit saved when saving the credit fails (not atomic)', async () => {
    repository.save
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('db down'));

    await expect(useCase.execute(command)).rejects.toThrow('db down');
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(repository.save.mock.calls[0][0].amount).toBe(BigInt(-15000));
  });
});
