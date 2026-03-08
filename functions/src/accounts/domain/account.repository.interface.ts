import { Account } from './account.entity';

export abstract class AccountRepository {
  abstract save(account: Account): Promise<void>;
  abstract findAllByOwner(ownerId: string): Promise<Account[]>;
  abstract findById(id: string): Promise<Account | null>;
}
