import { Module } from '@nestjs/common'
import { TransactionsService } from './transactions.service'
import { TransactionsController } from './transactions.controller'
import { SharedModule } from '../shared/shared.module'
import { SupabaseModule } from '../supabase/supabase.module'

/**
 * Transactions feature module
 * Handles CRUD operations and reconciliation workflow for transactions
 * @class TransactionsModule
 */
@Module({
  imports: [SharedModule, SupabaseModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
