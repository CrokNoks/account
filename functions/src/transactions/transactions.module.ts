import { Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TransactionRepository } from './domain/transaction.repository.interface';
import { SupabaseTransactionRepository } from './infrastructure/supabase-transaction.repository';
import { GetTransactionsByAccountUseCase } from './application/get-transactions-by-account.use-case';
import { CreateTransactionUseCase } from './application/create-transaction.use-case';
import { PredictCategoryUseCase } from './application/predict-category.use-case';
import { BulkCreateTransactionsUseCase } from './application/bulk-create-transactions.use-case';
import { BulkUpdateTransactionsUseCase } from './application/bulk-update-transactions.use-case';
import { BulkDeleteTransactionsUseCase } from './application/bulk-delete-transactions.use-case';
import { CreateTransferUseCase } from './application/create-transfer.use-case';
import { TransactionsController } from './infrastructure/transactions.controller';
import { PeriodsModule } from '../periods/periods.module';
import { SmartRulesModule } from '../smart-rules/smart-rules.module';

@Module({
  imports: [SupabaseModule, forwardRef(() => PeriodsModule), SmartRulesModule],
  controllers: [TransactionsController],
  providers: [
    {
      provide: TransactionRepository,
      useClass: SupabaseTransactionRepository,
    },
    GetTransactionsByAccountUseCase,
    CreateTransactionUseCase,
    PredictCategoryUseCase,
    BulkCreateTransactionsUseCase,
    BulkUpdateTransactionsUseCase,
    BulkDeleteTransactionsUseCase,
    CreateTransferUseCase,
  ],
  exports: [
    TransactionRepository,
    GetTransactionsByAccountUseCase,
    CreateTransactionUseCase,
    PredictCategoryUseCase,
    BulkCreateTransactionsUseCase,
    BulkUpdateTransactionsUseCase,
    BulkDeleteTransactionsUseCase,
    CreateTransferUseCase,
  ],
})
export class TransactionsModule {}
