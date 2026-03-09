import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { GetPeriodStatsUseCase, PeriodStatsResponse } from '../application/get-period-stats.use-case';
import { GetBudgetBreakdownUseCase, BudgetBreakdownResponse, BudgetCategoryBreakdown } from '../application/get-budget-breakdown.use-case';
import { GetEvolutionUseCase, EvolutionDataPoint } from '../application/get-evolution.use-case';

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

class EvolutionDataPointDto implements EvolutionDataPoint {
  @ApiProperty() periodId: string;
  @ApiProperty() startDate: string;
  @ApiProperty() endDate: string;
  @ApiProperty() realIncome: string;
  @ApiProperty() realExpenses: string;
  @ApiProperty() forecastBalance: string;
  @ApiProperty() realBankBalance: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } }) categories: Record<string, string>;
}

@ApiTags('reporting')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(':accountId')
export class ReportingController {
  constructor(
    private readonly getPeriodStatsUseCase: GetPeriodStatsUseCase,
    private readonly getBudgetBreakdownUseCase: GetBudgetBreakdownUseCase,
    private readonly getEvolutionUseCase: GetEvolutionUseCase,
  ) {}

  @Get('periods/:periodId/reporting/stats')
  @ApiOperation({ summary: 'Get financial stats for a specific period' })
  @ApiResponse({ status: 200, type: PeriodStatsResponseDto })
  async getStats(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string
  ): Promise<PeriodStatsResponseDto> {
    return this.getPeriodStatsUseCase.execute(accountId, periodId);
  }

  @Get('periods/:periodId/reporting/budget-breakdown')
  @ApiOperation({ summary: 'Get budget consumption breakdown by category type' })
  @ApiResponse({ status: 200, type: BudgetBreakdownResponseDto })
  async getBudgetBreakdown(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string
  ): Promise<BudgetBreakdownResponseDto> {
    return this.getBudgetBreakdownUseCase.execute(accountId, periodId);
  }

  @Get('reporting/evolution')
  @ApiOperation({ summary: 'Get account balance evolution over periods' })
  @ApiResponse({ status: 200, type: [EvolutionDataPointDto] })
  async getEvolution(
    @Param('accountId') accountId: string,
  ): Promise<EvolutionDataPointDto[]> {
    const data = await this.getEvolutionUseCase.execute(accountId);
    console.log(`[ReportingController] Evolution data points: ${data.length}`);
    if (data.length > 0) {
      console.log(`[ReportingController] Sample point categories keys: ${Object.keys(data[0].categories).join(', ')}`);
    }
    return data;
  }
}
