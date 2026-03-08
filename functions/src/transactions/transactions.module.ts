import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TransactionRepository } from './domain/transaction.repository.interface';
import { SupabaseTransactionRepository } from './infrastructure/supabase-transaction.repository';
import { GetTransactionsByAccountUseCase } from './application/get-transactions-by-account.use-case';
import { CreateTransactionUseCase } from './application/create-transaction.use-case';
import { TransactionsController } from './infrastructure/transactions.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [TransactionsController],
  providers: [
    {
      provide: TransactionRepository,
      useClass: SupabaseTransactionRepository,
    },
    GetTransactionsByAccountUseCase,
    CreateTransactionUseCase,
  ],
  exports: [TransactionRepository, GetTransactionsByAccountUseCase, CreateTransactionUseCase],
})
export class TransactionsModule {}
