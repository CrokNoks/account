import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CategoriesModule } from '../categories/categories.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { PeriodRepository } from './domain/period.repository.interface';
import { SupabasePeriodRepository } from './infrastructure/supabase-period.repository';
import { GetPeriodDraftUseCase } from './application/get-period-draft.use-case';
import { CreatePeriodWithBudgetsUseCase } from './application/create-period-with-budgets.use-case';
import { PeriodsController } from './infrastructure/periods.controller';

@Module({
  imports: [SupabaseModule, CategoriesModule, BudgetsModule],
  controllers: [PeriodsController],
  providers: [
    {
      provide: PeriodRepository,
      useClass: SupabasePeriodRepository,
    },
    GetPeriodDraftUseCase,
    CreatePeriodWithBudgetsUseCase,
  ],
  exports: [PeriodRepository, GetPeriodDraftUseCase, CreatePeriodWithBudgetsUseCase],
})
export class PeriodsModule {}
