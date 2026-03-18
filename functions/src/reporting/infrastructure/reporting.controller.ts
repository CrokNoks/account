import {
  Controller,
  Get,
  Param,
  UseGuards,
  Query,
  Post,
  Body,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import {
  GetPeriodStatsUseCase,
  PeriodStatsResponse,
} from '../application/get-period-stats.use-case';
import {
  GetBudgetBreakdownUseCase,
  BudgetBreakdownResponse,
  BudgetCategoryBreakdown,
} from '../application/get-budget-breakdown.use-case';
import {
  GetEvolutionUseCase,
  EvolutionDataPoint,
} from '../application/get-evolution.use-case';
import {
  GetPeriodComparisonUseCase,
  PeriodComparisonResponse,
} from '../application/get-period-comparison.use-case';
import {
  GetSankeyDataUseCase,
  SankeyDataResponse,
} from '../application/get-sankey-data.use-case';
import { GetAIInsightsUseCase } from '../application/get-ai-insights.use-case';
import { GetEvolutionAIInsightsUseCase } from '../application/get-evolution-ai-insights.use-case';
import {
  GetCashflowForecastUseCase,
  CashflowForecastResponse,
} from '../application/get-cashflow-forecast.use-case';
import {
  GetTagsSummaryUseCase,
  TagSummary,
} from '../application/get-tags-summary.use-case';
import {
  GetTagDetailsUseCase,
  TagDetails,
  TagCategoryBreakdown,
} from '../application/get-tag-details.use-case';
import {
  GetCalendarDataUseCase,
  CalendarEvent,
} from '../application/get-calendar-data.use-case';
import {
  GetAnomaliesUseCase,
  Anomaly,
} from '../application/get-anomalies.use-case';
import { IgnoreAnomalyUseCase } from '../application/ignore-anomaly.use-case';
import {
  GetNetWorthUseCase,
  NetWorthResponse,
} from '../application/get-net-worth.use-case';
import {
  ScanReceiptUseCase,
  ScanReceiptResult,
} from '../application/scan-receipt.use-case';
import { IsArray, IsString, IsIn } from 'class-validator';

export class IgnoreAnomalyDto {
  @IsArray()
  @IsString({ each: true })
  @ApiProperty()
  transactionIds: string[];

  @IsString()
  @IsIn(['duplicate', 'spike', 'outlier'])
  @ApiProperty({ enum: ['duplicate', 'spike', 'outlier'] })
  type: 'duplicate' | 'spike' | 'outlier';
}

class AnomalyDto implements Anomaly {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['duplicate', 'spike', 'outlier'] }) type:
    | 'duplicate'
    | 'spike'
    | 'outlier';
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: ['medium', 'high'] }) severity: 'medium' | 'high';
  @ApiProperty() transactionIds: string[];
}

class CalendarEventDto implements CalendarEvent {
  @ApiProperty() id: string;
  @ApiProperty() date: string;
  @ApiProperty() description: string;
  @ApiProperty() amount: string;
  @ApiProperty({ enum: ['actual', 'recurring'] }) type: 'actual' | 'recurring';
  @ApiProperty({ nullable: true }) categoryId: string | null;
}

class TagSummaryDto implements TagSummary {
  @ApiProperty() tagId: string;
  @ApiProperty() name: string;
  @ApiProperty() color: string;
  @ApiProperty() totalAmount: string;
  @ApiProperty() transactionCount: number;
}

class TagCategoryBreakdownDto implements TagCategoryBreakdown {
  @ApiProperty({ nullable: true }) categoryId: string | null;
  @ApiProperty() name: string;
  @ApiProperty() amount: string;
  @ApiProperty() percentage: number;
}

class TagRecentTransactionDto {
  @ApiProperty() id: string;
  @ApiProperty() description: string;
  @ApiProperty() date: string;
  @ApiProperty() amount: string;
}

class TagDetailsDto implements TagDetails {
  @ApiProperty({ type: TagSummaryDto })
  summary: TagSummaryDto;
  @ApiProperty({ type: [TagCategoryBreakdownDto] })
  categoryBreakdown: TagCategoryBreakdownDto[];
  @ApiProperty({ type: [TagRecentTransactionDto] })
  recentTransactions: TagRecentTransactionDto[];
}

class BudgetCategoryBreakdownDto implements BudgetCategoryBreakdown {
  @ApiProperty() categoryId: string;
  @ApiProperty() name: string;
  @ApiProperty() real: string;
  @ApiProperty() budget: string;
  @ApiProperty() remaining: string;
  @ApiProperty() percentage: number;
}

class BudgetBreakdownResponseDto implements BudgetBreakdownResponse {
  @ApiProperty({ type: [BudgetCategoryBreakdownDto] })
  income: BudgetCategoryBreakdownDto[];
  @ApiProperty({ type: [BudgetCategoryBreakdownDto] })
  expenses: BudgetCategoryBreakdownDto[];
  @ApiProperty({ type: [BudgetCategoryBreakdownDto] })
  savings: BudgetCategoryBreakdownDto[];
  @ApiProperty({ type: [BudgetCategoryBreakdownDto] })
  transfers: BudgetCategoryBreakdownDto[];
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
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  categories: Record<string, string>;
}

class NetWorthDataPointDto {
  @ApiProperty() date: string;
  @ApiProperty() amount: string;
}

class NetWorthResponseDto implements NetWorthResponse {
  @ApiProperty() currentTotal: string;
  @ApiProperty({ type: [NetWorthDataPointDto] })
  history: NetWorthDataPointDto[];
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
    private readonly getTagsSummaryUseCase: GetTagsSummaryUseCase,
    private readonly getTagDetailsUseCase: GetTagDetailsUseCase,
    private readonly getCalendarDataUseCase: GetCalendarDataUseCase,
    private readonly getAnomaliesUseCase: GetAnomaliesUseCase,
    private readonly ignoreAnomalyUseCase: IgnoreAnomalyUseCase,
    private readonly getNetWorthUseCase: GetNetWorthUseCase,
    private readonly scanReceiptUseCase: ScanReceiptUseCase,
  ) {}

  @Post('reporting/anomalies/ignore')
  @ApiOperation({ summary: 'Ignore specific anomalies for given transactions' })
  @ApiResponse({ status: 201 })
  async ignoreAnomaly(
    @Param('accountId') accountId: string,
    @Body() dto: IgnoreAnomalyDto,
  ): Promise<{ success: boolean }> {
    await this.ignoreAnomalyUseCase.execute(
      accountId,
      dto.transactionIds,
      dto.type,
    );
    return { success: true };
  }

  @Get('reporting/net-worth')
  @ApiOperation({
    summary: 'Get total net worth evolution across all accounts',
  })
  @ApiResponse({ status: 200, type: NetWorthResponseDto })
  async getNetWorth(@Request() req: any): Promise<NetWorthResponseDto> {
    return this.getNetWorthUseCase.execute(req.user.id);
  }

  @Get('periods/:periodId/reporting/stats')
  @ApiOperation({ summary: 'Get financial stats for a specific period' })
  @ApiResponse({ status: 200, type: PeriodStatsResponseDto })
  async getStats(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string,
  ): Promise<PeriodStatsResponseDto> {
    return this.getPeriodStatsUseCase.execute(accountId, periodId);
  }

  @Get('periods/:periodId/reporting/budget-breakdown')
  @ApiOperation({
    summary: 'Get budget consumption breakdown by category type',
  })
  @ApiResponse({ status: 200, type: BudgetBreakdownResponseDto })
  async getBudgetBreakdown(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string,
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
      console.log(
        `[ReportingController] Sample point categories keys: ${Object.keys(data[0].categories).join(', ')}`,
      );
    }
    return data;
  }

  @Get('periods/:periodId/reporting/comparison')
  @ApiOperation({ summary: 'Compare current period with another' })
  async getComparison(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string,
    @Query('compareWith') compareWithId: string,
  ): Promise<PeriodComparisonResponse> {
    return this.getPeriodComparisonUseCase.execute(
      accountId,
      compareWithId,
      periodId,
    );
  }

  @Get('periods/:periodId/reporting/sankey')
  @ApiOperation({ summary: 'Get data for Sankey diagram' })
  async getSankey(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string,
  ): Promise<SankeyDataResponse> {
    return this.getSankeyDataUseCase.execute(accountId, periodId);
  }

  @Get('periods/:periodId/reporting/ai-insights')
  @ApiOperation({ summary: 'Get AI-generated financial insights' })
  async getAIInsights(
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string,
    @Query('locale') locale: string = 'fr',
  ): Promise<{ insights: string }> {
    const insights = await this.getAIInsightsUseCase.execute(
      accountId,
      periodId,
      locale,
    );
    return { insights };
  }

  @Get('reporting/evolution/ai-insights')
  @ApiOperation({ summary: 'Get AI-generated evolution insights' })
  async getEvolutionAIInsights(
    @Param('accountId') accountId: string,
    @Query('locale') locale: string = 'fr',
  ): Promise<{ insights: string }> {
    const insights = await this.getEvolutionAIInsightsUseCase.execute(
      accountId,
      locale,
    );
    return { insights };
  }

  @Post('reporting/cashflow')
  @ApiOperation({
    summary: 'Get cashflow forecast based on recurring transactions',
  })
  async getCashflow(
    @Param('accountId') accountId: string,
    @Query('days') days?: number,
  ): Promise<CashflowForecastResponse> {
    return this.getCashflowForecastUseCase.execute(accountId, days);
  }

  @Post('reporting/scan-receipt')
  @ApiOperation({ summary: 'Scan a receipt image to extract data' })
  async scanReceipt(
    @Body() dto: { base64Image: string; mimeType: string },
  ): Promise<ScanReceiptResult> {
    return this.scanReceiptUseCase.execute(dto.base64Image, dto.mimeType);
  }

  @Get('reporting/tags-summary')
  @ApiOperation({ summary: 'Get summary of all tags for a period or global' })
  @ApiResponse({ status: 200, type: [TagSummaryDto] })
  async getTagsSummary(
    @Param('accountId') accountId: string,
    @Query('periodId') periodId?: string,
  ): Promise<TagSummaryDto[]> {
    return this.getTagsSummaryUseCase.execute(accountId, periodId);
  }

  @Get('reporting/tags/:tagId')
  @ApiOperation({ summary: 'Get detailed stats for a specific tag' })
  @ApiResponse({ status: 200, type: TagDetailsDto })
  async getTagDetails(
    @Param('accountId') accountId: string,
    @Param('tagId') tagId: string,
    @Query('periodId') periodId?: string,
  ): Promise<TagDetailsDto> {
    return this.getTagDetailsUseCase.execute(accountId, tagId, periodId);
  }

  @Get('reporting/calendar')
  @ApiOperation({ summary: 'Get financial calendar data for a specific month' })
  @ApiResponse({ status: 200, type: [CalendarEventDto] })
  async getCalendar(
    @Param('accountId') accountId: string,
    @Query('year') year: number,
    @Query('month') month: number,
  ): Promise<CalendarEventDto[]> {
    return this.getCalendarDataUseCase.execute(
      accountId,
      Number(year),
      Number(month),
    );
  }

  @Get('reporting/anomalies')
  @ApiOperation({ summary: 'Detect transaction anomalies for a given period' })
  @ApiResponse({ status: 200, type: [AnomalyDto] })
  async getAnomalies(
    @Param('accountId') accountId: string,
    @Query('periodId') periodId?: string,
  ): Promise<AnomalyDto[]> {
    return this.getAnomaliesUseCase.execute(accountId, periodId);
  }
}
