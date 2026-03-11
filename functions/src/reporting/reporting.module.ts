import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { PeriodsModule } from '../periods/periods.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { RecurringModule } from '../recurring/recurring.module';
import { GetPeriodStatsUseCase } from './application/get-period-stats.use-case';
import { GetBudgetBreakdownUseCase } from './application/get-budget-breakdown.use-case';
import { GetEvolutionUseCase } from './application/get-evolution.use-case';
import { GetPeriodComparisonUseCase } from './application/get-period-comparison.use-case';
import { GetSankeyDataUseCase } from './application/get-sankey-data.use-case';
import { GetAIInsightsUseCase } from './application/get-ai-insights.use-case';
import { GetEvolutionAIInsightsUseCase } from './application/get-evolution-ai-insights.use-case';
import { GetCashflowForecastUseCase } from './application/get-cashflow-forecast.use-case';
import { ScanReceiptUseCase } from './application/scan-receipt.use-case';
import { GeminiService } from './application/gemini.service';
import { ReportingController } from './infrastructure/reporting.controller';

@Module({
  imports: [
    AccountsModule,
    CategoriesModule,
    PeriodsModule,
    TransactionsModule,
    BudgetsModule,
    RecurringModule,
  ],
  controllers: [ReportingController],
  providers: [
    GetPeriodStatsUseCase,
    GetBudgetBreakdownUseCase,
    GetEvolutionUseCase,
    GetPeriodComparisonUseCase,
    GetSankeyDataUseCase,
    GetAIInsightsUseCase,
    GetEvolutionAIInsightsUseCase,
    GetCashflowForecastUseCase,
    ScanReceiptUseCase,
    GeminiService,
  ],
})
export class ReportingModule {}
