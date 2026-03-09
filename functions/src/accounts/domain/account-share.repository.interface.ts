import { AccountShare } from './account-share.entity';

export abstract class AccountShareRepository {
  abstract findAllByAccount(accountId: string): Promise<AccountShare[]>;
  abstract save(share: AccountShare): Promise<void>;
  abstract delete(accountId: string, userId: string): Promise<void>;
}
