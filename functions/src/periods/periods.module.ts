import { Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CategoriesModule } from '../categories/categories.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { RecurringModule } from '../recurring/recurring.module';
import { PeriodRepository } from './domain/period.repository.interface';
import { SupabasePeriodRepository } from './infrastructure/supabase-period.repository';
import { GetPeriodDraftUseCase } from './application/get-period-draft.use-case';
import { CreatePeriodWithBudgetsUseCase } from './application/create-period-with-budgets.use-case';
import { UpdatePeriodBudgetsUseCase } from './application/update-period-budgets.use-case';
import { PeriodsController } from './infrastructure/periods.controller';

@Module({
  imports: [
    SupabaseModule,
    CategoriesModule,
    BudgetsModule,
    forwardRef(() => TransactionsModule),
    RecurringModule,
  ],
  controllers: [PeriodsController],
  providers: [
    {
      provide: PeriodRepository,
      useClass: SupabasePeriodRepository,
    },
    GetPeriodDraftUseCase,
    CreatePeriodWithBudgetsUseCase,
    UpdatePeriodBudgetsUseCase,
  ],
  exports: [
    PeriodRepository,
    GetPeriodDraftUseCase,
    CreatePeriodWithBudgetsUseCase,
    UpdatePeriodBudgetsUseCase,
  ],
})
export class PeriodsModule {}
