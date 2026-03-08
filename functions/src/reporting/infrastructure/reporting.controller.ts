import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { GetPeriodStatsUseCase, PeriodStatsResponse } from '../application/get-period-stats.use-case';
import { GetBudgetBreakdownUseCase, BudgetBreakdownResponse, BudgetCategoryBreakdown } from '../application/get-budget-breakdown.use-case';

class BudgetCategoryBreakdownDto implements BudgetCategoryBreakdown {
  @ApiProperty() categoryId: string;
  @ApiProperty() name: string;
  @ApiProperty() real: string;
  @ApiProperty() budget: string;
  @ApiProperty() remaining: string;
  @ApiProperty() percentage: number;
}

class BudgetBreakdownResponseDto implements BudgetBreakdownResponse {
  @ApiProperty({ type: [BudgetCategoryBreakdownDto] }) income: BudgetCategoryBreakdownDto[];
  @ApiProperty({ type: [BudgetCategoryBreakdownDto] }) expenses: BudgetCategoryBreakdownDto[];
  @ApiProperty({ type: [BudgetCategoryBreakdownDto] }) savings: BudgetCategoryBreakdownDto[];
  @ApiProperty({ type: [BudgetCategoryBreakdownDto] }) transfers: BudgetCategoryBreakdownDto[];
}

class PeriodStatsResponseDto implements PeriodStatsResponse {
  @ApiProperty() startBalance: string;
  @ApiProperty() realIncome: string;
  @ApiProperty() plannedIncome: string;
  @ApiProperty() realExpenses: string;
  @ApiProperty() plannedExpenses: string;
  @ApiProperty() realBankBalance: string;
  @ApiProperty() upcomingBalance: string;
  @ApiProperty() forecastBalance: string;
}

@ApiTags('reporting')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(':accountId/periods/:periodId/reporting')
export class ReportingController {
  constructor(
    private readonly getPeriodStatsUseCase: GetPeriodStatsUseCase,
    private readonly getBudgetBreakdownUseCase: GetBudgetBreakdownUseCase,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get financial stats for a specific period' })
  @ApiResponse({ status: 200, type: PeriodStatsResponseDto })
  async getStats(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string
  ): Promise<PeriodStatsResponseDto> {
    return this.getPeriodStatsUseCase.execute(accountId, periodId);
  }

  @Get('budget-breakdown')
  @ApiOperation({ summary: 'Get budget consumption breakdown by category type' })
  @ApiResponse({ status: 200, type: BudgetBreakdownResponseDto })
  async getBudgetBreakdown(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string
  ): Promise<BudgetBreakdownResponseDto> {
    return this.getBudgetBreakdownUseCase.execute(accountId, periodId);
  }
}
