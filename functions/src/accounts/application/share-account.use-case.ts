import { Injectable } from '@nestjs/common';
import { AccountShareRepository } from '../domain/account-share.repository.interface';
import { AccountRepository } from '../domain/account.repository.interface';
import { UserRepository } from '../domain/user.repository.interface';
import { AccountShare } from '../domain/account-share.entity';

export interface ShareAccountInput {
  accountId: string;
  email: string;
  permission: 'read' | 'write';
  initiatorId: string;
}

@Injectable()
export class ShareAccountUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly accountShareRepository: AccountShareRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: ShareAccountInput): Promise<void> {
    const account = await this.accountRepository.findById(input.accountId);
    if (!account) throw new Error('Account not found');

    // Only owner can share
    if (account.ownerId !== input.initiatorId) {
      throw new Error('Only the account owner can manage shares');
    }

    const targetUser = await this.userRepository.findByEmail(input.email);
    if (!targetUser) {
      throw new Error(
        `User with email ${input.email} not found. They must have logged in at least once.`,
      );
    }

    if (targetUser.id === account.ownerId) {
      throw new Error(
        'You cannot share an account with yourself (you are the owner)',
      );
    }

    await this.accountShareRepository.save(
      new AccountShare({
        accountId: input.accountId,
        userId: targetUser.id,
        permission: input.permission,
      }),
    );
  }
}
