import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { RecurringTransactionRepository } from './domain/recurring-transaction.repository.interface';
import { SupabaseRecurringTransactionRepository } from './infrastructure/supabase-recurring-transaction.repository';
import { GetRecurringTransactionsUseCase } from './application/get-recurring-transactions.use-case';
import { CreateRecurringTransactionUseCase } from './application/create-recurring-transaction.use-case';
import { UpdateRecurringTransactionUseCase } from './application/update-recurring-transaction.use-case';
import { DeleteRecurringTransactionUseCase } from './application/delete-recurring-transaction.use-case';
import { RecurringController } from './infrastructure/recurring.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [RecurringController],
  providers: [
    {
      provide: RecurringTransactionRepository,
      useClass: SupabaseRecurringTransactionRepository,
    },
    GetRecurringTransactionsUseCase,
    CreateRecurringTransactionUseCase,
    UpdateRecurringTransactionUseCase,
    DeleteRecurringTransactionUseCase,
  ],
  exports: [RecurringTransactionRepository, GetRecurringTransactionsUseCase],
})
export class RecurringModule {}
