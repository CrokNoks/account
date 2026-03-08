import { Module, Global } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { BudgetRepository } from './domain/budget.repository.interface';
import { SupabaseBudgetRepository } from './infrastructure/supabase-budget.repository';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [
    {
      provide: BudgetRepository,
      useClass: SupabaseBudgetRepository,
    },
  ],
  exports: [BudgetRepository],
})
export class BudgetsModule {}
