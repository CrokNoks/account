import { Controller, Get, Post, Body, Param, UseGuards, Request, Query, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { GetPeriodDraftUseCase, PeriodDraft } from '../application/get-period-draft.use-case';
import { CreatePeriodWithBudgetsUseCase } from '../application/create-period-with-budgets.use-case';
import { PeriodRepository } from '../domain/period.repository.interface';
import { IsString, IsDateString, IsArray, ValidateNested, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class BudgetInitDto {
  @IsString()
  @ApiProperty()
  categoryId: string;

  @IsString()
  @ApiProperty({ description: 'Amount allocated in cents (stringified BigInt)' })
  amountAllocated: string;
}

export class CreatePeriodDto {
  @IsString()
  @ApiProperty()
  accountId: string;

  @IsDateString()
  @ApiProperty()
  startDate: string;

  @IsDateString()
  @ApiProperty()
  endDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetInitDto)
  @ApiProperty({ type: [BudgetInitDto] })
  budgets: BudgetInitDto[];

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  injectRecurring?: boolean;
}

export class UpdatePeriodDto {
  @IsOptional() @IsDateString() @ApiProperty({ required: false }) startDate?: string;
  @IsOptional() @IsDateString() @ApiProperty({ required: false }) endDate?: string;
  @IsOptional() @IsBoolean() @ApiProperty({ required: false }) isActive?: boolean;
}

@ApiTags('periods')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(':accountId/periods')
export class PeriodsController {
  constructor(
    private readonly getPeriodDraftUseCase: GetPeriodDraftUseCase,
    private readonly createPeriodWithBudgetsUseCase: CreatePeriodWithBudgetsUseCase,
    private readonly periodRepository: PeriodRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all periods for this account' })
  @ApiResponse({ status: 200 })
  async findAll(@Param('accountId') accountId: string) {
    return this.periodRepository.findAllByAccount(accountId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single period' })
  @ApiResponse({ status: 200 })
  async findOne(@Param('accountId') accountId: string, @Param('id') id: string) {
    return this.periodRepository.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a period' })
  @ApiResponse({ status: 200 })
  async update(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePeriodDto
  ) {
    const existing = await this.periodRepository.findById(id);
    if (!existing) throw new Error('Period not found');

    const updated = new (existing as any).constructor({
      ...existing,
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : (existing as any).startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : (existing as any).endDate,
      updatedAt: new Date(),
    });

    await this.periodRepository.save(updated);
    return updated;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a period' })
  @ApiResponse({ status: 200 })
  async remove(@Param('accountId') accountId: string, @Param('id') id: string) {
    return this.periodRepository.delete(id);
  }

  @Get('draft-init')
  @ApiOperation({ summary: 'Get suggested dates and historical stats for a new period' })
  @ApiResponse({ status: 200 })
  async getDraft(@Param('accountId') accountId: string): Promise<PeriodDraft> {
    return this.getPeriodDraftUseCase.execute(accountId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new period with initial budgets for this account' })
  @ApiResponse({ status: 201 })
  async create(
    @Param('accountId') accountId: string,
    @Body() dto: Omit<CreatePeriodDto, 'accountId'>
  ) {
    const result = await this.createPeriodWithBudgetsUseCase.execute({
      accountId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      budgets: dto.budgets.map(b => ({
        categoryId: b.categoryId,
        amountAllocated: BigInt(b.amountAllocated),
      })),
      injectRecurring: dto.injectRecurring,
    });

    return {
      id: result.period.id,
      startDate: result.period.startDate.toISOString(),
      endDate: result.period.endDate.toISOString(),
      budgetsCreated: result.budgets.length,
    };
  }
}
