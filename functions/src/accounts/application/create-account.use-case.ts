import { Account } from '../domain/account.entity';
import { AccountRepository } from '../domain/account.repository.interface';
import { randomUUID } from 'node:crypto';

export interface CreateAccountInput {
  name: string;
  ownerId: string;
  initialBalance?: bigint;
}

export class CreateAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: CreateAccountInput): Promise<Account> {
    const account = new Account({
      id: randomUUID(),
      name: input.name,
      ownerId: input.ownerId,
      initialBalance: input.initialBalance ?? 0n,
    });

    await this.accountRepository.save(account);

    return account;
  }
}
