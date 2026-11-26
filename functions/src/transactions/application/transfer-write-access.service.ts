import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { AccountShareRepository } from '../../accounts/domain/account-share.repository.interface';

export interface WriteAccessMessages {
  notFound: string;
  forbidden: string;
}

/**
 * Règle unique « puis-je écrire sur ce compte ? » pour tout ce qui écrit sur
 * le compte d'un autre côté de virement (création, modification, suppression).
 *
 * Le compte doit être accessible (la lecture passe par la RLS : introuvable =
 * 404) et en écriture : propriétaire, ou partage « write ». Un utilisateur peut
 * lire sa propre ligne de partage (policy « Owners can view shares for their
 * accounts », `user_id = auth.uid()`).
 */
@Injectable()
export class TransferWriteAccessService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly accountShareRepository: AccountShareRepository,
  ) {}

  async ensureCanWriteTo(
    accountId: string,
    userId: string,
    messages: WriteAccessMessages,
  ): Promise<void> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) throw new NotFoundError(messages.notFound);
    if (account.ownerId === userId) return;

    const shares =
      await this.accountShareRepository.findAllByAccount(accountId);
    const mine = shares.find((s) => s.userId === userId);
    if (mine?.permission !== 'write') {
      throw new ForbiddenError(messages.forbidden);
    }
  }
}
