import { ShareAccountUseCase } from './share-account.use-case';
import { AccountRepository } from '../domain/account.repository.interface';
import { AccountShareRepository } from '../domain/account-share.repository.interface';
import { UserRepository } from '../domain/user.repository.interface';
import { Account } from '../domain/account.entity';
import { AccountShare } from '../domain/account-share.entity';

describe('ShareAccountUseCase', () => {
  let accounts: { findById: jest.Mock };
  let shares: { save: jest.Mock };
  let users: { findByEmail: jest.Mock };
  let useCase: ShareAccountUseCase;

  const input = {
    accountId: 'acc-1',
    email: 'guest@example.com',
    permission: 'read' as const,
    initiatorId: 'owner-1',
  };

  beforeEach(() => {
    accounts = {
      findById: jest
        .fn()
        .mockResolvedValue(
          new Account({ id: 'acc-1', name: 'Courant', ownerId: 'owner-1' }),
        ),
    };
    shares = { save: jest.fn().mockResolvedValue(undefined) };
    users = {
      findByEmail: jest
        .fn()
        .mockResolvedValue({ id: 'guest-1', email: 'guest@example.com' }),
    };
    useCase = new ShareAccountUseCase(
      accounts as unknown as AccountRepository,
      shares as unknown as AccountShareRepository,
      users as unknown as UserRepository,
    );
  });

  it.each(['read', 'write'] as const)(
    'shares the account with the target user (%s)',
    async (permission) => {
      await useCase.execute({ ...input, permission });

      expect(users.findByEmail).toHaveBeenCalledWith('guest@example.com');
      const [[share]] = shares.save.mock.calls as [AccountShare][];
      expect(share).toBeInstanceOf(AccountShare);
      expect(share).toMatchObject({
        accountId: 'acc-1',
        userId: 'guest-1',
        permission,
      });
    },
  );

  it('rejects an unknown account', async () => {
    accounts.findById.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow('Account not found');
    expect(shares.save).not.toHaveBeenCalled();
  });

  it('rejects when the initiator is not the owner', async () => {
    await expect(
      useCase.execute({ ...input, initiatorId: 'someone-else' }),
    ).rejects.toThrow('Only the account owner can manage shares');
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(shares.save).not.toHaveBeenCalled();
  });

  it('rejects an email without user account', async () => {
    users.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow(
      'User with email guest@example.com not found',
    );
    expect(shares.save).not.toHaveBeenCalled();
  });

  it('rejects sharing with the owner themself', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
    });

    await expect(useCase.execute(input)).rejects.toThrow(
      'You cannot share an account with yourself',
    );
    expect(shares.save).not.toHaveBeenCalled();
  });
});
