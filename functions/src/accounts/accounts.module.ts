import { Module } from '@nestjs/common';
import { SupabaseAccountRepository } from './infrastructure/supabase-account.repository';
import { AccountRepository } from './domain/account.repository.interface';
import { CreateAccountUseCase } from './application/create-account.use-case';
import { GetAccountsUseCase } from './application/get-accounts.use-case';
import { AccountsController } from './infrastructure/accounts.controller';

@Module({
  controllers: [AccountsController],
  providers: [
    {
      provide: AccountRepository,
      useClass: SupabaseAccountRepository,
    },
    {
      provide: CreateAccountUseCase,
      useFactory: (repository: AccountRepository) => new CreateAccountUseCase(repository),
      inject: [AccountRepository],
    },
    {
      provide: GetAccountsUseCase,
      useFactory: (repository: AccountRepository) => new GetAccountsUseCase(repository),
      inject: [AccountRepository],
    },
  ],
  exports: [AccountRepository, CreateAccountUseCase, GetAccountsUseCase],
})
export class AccountsModule {}
