import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { PeriodsModule } from '../periods/periods.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { GetPeriodStatsUseCase } from './application/get-period-stats.use-case';
import { GetBudgetBreakdownUseCase } from './application/get-budget-breakdown.use-case';
import { GetEvolutionUseCase } from './application/get-evolution.use-case';
import { ReportingController } from './infrastructure/reporting.controller';

@Module({
  imports: [
    AccountsModule,
    CategoriesModule,
    PeriodsModule,
    TransactionsModule,
    BudgetsModule,
  ],
  controllers: [ReportingController],
  providers: [
    GetPeriodStatsUseCase,
    GetBudgetBreakdownUseCase,
    GetEvolutionUseCase,
  ],
})
export class ReportingModule {}
