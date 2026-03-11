import { Controller, Get, Param, UseGuards, Query, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { GetPeriodStatsUseCase, PeriodStatsResponse } from '../application/get-period-stats.use-case';
import { GetBudgetBreakdownUseCase, BudgetBreakdownResponse, BudgetCategoryBreakdown } from '../application/get-budget-breakdown.use-case';
import { GetEvolutionUseCase, EvolutionDataPoint } from '../application/get-evolution.use-case';
import { GetPeriodComparisonUseCase, PeriodComparisonResponse } from '../application/get-period-comparison.use-case';
import { GetSankeyDataUseCase, SankeyDataResponse } from '../application/get-sankey-data.use-case';
import { GetAIInsightsUseCase } from '../application/get-ai-insights.use-case';
import { GetEvolutionAIInsightsUseCase } from '../application/get-evolution-ai-insights.use-case';
import { GetCashflowForecastUseCase, CashflowForecastResponse } from '../application/get-cashflow-forecast.use-case';
import { ScanReceiptUseCase, ScanReceiptResult } from '../application/scan-receipt.use-case';

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
  @ApiProperty() isActive: boolean;
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
    private readonly getPeriodComparisonUseCase: GetPeriodComparisonUseCase,
    private readonly getSankeyDataUseCase: GetSankeyDataUseCase,
    private readonly getAIInsightsUseCase: GetAIInsightsUseCase,
    private readonly getEvolutionAIInsightsUseCase: GetEvolutionAIInsightsUseCase,
    private readonly getCashflowForecastUseCase: GetCashflowForecastUseCase,
    private readonly scanReceiptUseCase: ScanReceiptUseCase,
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

  @Get('periods/:periodId/reporting/comparison')
  @ApiOperation({ summary: 'Compare current period with another' })
  async getComparison(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string,
    @Query('compareWith') compareWithId: string
  ): Promise<PeriodComparisonResponse> {
    return this.getPeriodComparisonUseCase.execute(accountId, compareWithId, periodId);
  }

  @Get('periods/:periodId/reporting/sankey')
  @ApiOperation({ summary: 'Get data for Sankey diagram' })
  async getSankey(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string
  ): Promise<SankeyDataResponse> {
    return this.getSankeyDataUseCase.execute(accountId, periodId);
  }

  @Get('periods/:periodId/reporting/ai-insights')
  @ApiOperation({ summary: 'Get AI-generated financial insights' })
  async getAIInsights(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string,
    @Query('locale') locale: string = 'fr'
  ): Promise<{ insights: string }> {
    const insights = await this.getAIInsightsUseCase.execute(accountId, periodId, locale);
    return { insights };
  }

  @Get('reporting/evolution/ai-insights')
  @ApiOperation({ summary: 'Get AI-generated evolution insights' })
  async getEvolutionAIInsights(
    @Param('accountId') accountId: string,
    @Query('locale') locale: string = 'fr'
  ): Promise<{ insights: string }> {
    const insights = await this.getEvolutionAIInsightsUseCase.execute(accountId, locale);
    return { insights };
  }

  @Post('reporting/cashflow')
  @ApiOperation({ summary: 'Get cashflow forecast based on recurring transactions' })
  async getCashflow(
    @Param('accountId') accountId: string,
    @Query('days') days?: number
  ): Promise<CashflowForecastResponse> {
    return this.getCashflowForecastUseCase.execute(accountId, days);
  }

  @Post('reporting/scan-receipt')
  @ApiOperation({ summary: 'Scan a receipt image to extract data' })
  async scanReceipt(
    @Body() dto: { base64Image: string, mimeType: string }
  ): Promise<ScanReceiptResult> {
    return this.scanReceiptUseCase.execute(dto.base64Image, dto.mimeType);
  }
}
