import { Account } from '../domain/account.entity';
import { AccountRepository } from '../domain/account.repository.interface';

export class GetAccountsUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(ownerId: string): Promise<Account[]> {
    return this.accountRepository.findAllByOwner(ownerId);
  }
}
