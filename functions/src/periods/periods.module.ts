import { Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CategoriesModule } from '../categories/categories.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { RecurringModule } from '../recurring/recurring.module';
import { PeriodRepositoryModule } from './period-repository.module';
import { GetPeriodDraftUseCase } from './application/get-period-draft.use-case';
import { CreatePeriodWithBudgetsUseCase } from './application/create-period-with-budgets.use-case';
import { UpdatePeriodBudgetsUseCase } from './application/update-period-budgets.use-case';
import { AccountReferencesModule } from '../shared/account-references.module';
import { PeriodsController } from './infrastructure/periods.controller';
import { BudgetTemplatesController } from './infrastructure/budget-templates.controller';
import { SaveBudgetTemplatesUseCase } from './application/save-budget-templates.use-case';

@Module({
  imports: [
    SupabaseModule,
    PeriodRepositoryModule,
    CategoriesModule,
    BudgetsModule,
    forwardRef(() => TransactionsModule),
    RecurringModule,
    AccountReferencesModule,
  ],
  controllers: [PeriodsController, BudgetTemplatesController],
  providers: [
    GetPeriodDraftUseCase,
    CreatePeriodWithBudgetsUseCase,
    UpdatePeriodBudgetsUseCase,
    SaveBudgetTemplatesUseCase,
  ],
  exports: [
    PeriodRepositoryModule,
    GetPeriodDraftUseCase,
    CreatePeriodWithBudgetsUseCase,
    UpdatePeriodBudgetsUseCase,
  ],
})
export class PeriodsModule {}
