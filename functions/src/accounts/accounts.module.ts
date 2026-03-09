import { Module } from '@nestjs/common';
import { SupabaseAccountRepository } from './infrastructure/supabase-account.repository';
import { AccountRepository } from './domain/account.repository.interface';
import { CreateAccountUseCase } from './application/create-account.use-case';
import { GetAccountsUseCase } from './application/get-accounts.use-case';
import { ShareAccountUseCase } from './application/share-account.use-case';
import { AccountsController } from './infrastructure/accounts.controller';
import { AccountShareRepository } from './domain/account-share.repository.interface';
import { SupabaseAccountShareRepository } from './infrastructure/supabase-account-share.repository';
import { UserRepository } from './domain/user.repository.interface';
import { SupabaseUserRepository } from './infrastructure/supabase-user.repository';

@Module({
  controllers: [AccountsController],
  providers: [
    {
      provide: AccountRepository,
      useClass: SupabaseAccountRepository,
    },
    {
      provide: AccountShareRepository,
      useClass: SupabaseAccountShareRepository,
    },
    {
      provide: UserRepository,
      useClass: SupabaseUserRepository,
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
    {
      provide: ShareAccountUseCase,
      useFactory: (accRepo: AccountRepository, shareRepo: AccountShareRepository, userRepo: UserRepository) => 
        new ShareAccountUseCase(accRepo, shareRepo, userRepo),
      inject: [AccountRepository, AccountShareRepository, UserRepository],
    },
  ],
  exports: [AccountRepository, AccountShareRepository, UserRepository, CreateAccountUseCase, GetAccountsUseCase, ShareAccountUseCase],
})
export class AccountsModule {}
