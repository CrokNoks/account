import { parseDateOnly } from '../../shared/domain/date-only';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Delete,
  HttpCode,
  Query,
  Patch,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { GetTransactionsByAccountUseCase } from '../application/get-transactions-by-account.use-case';
import { CreateTransactionUseCase } from '../application/create-transaction.use-case';
import { PredictCategoryUseCase } from '../application/predict-category.use-case';
import { BulkCreateTransactionsUseCase } from '../application/bulk-create-transactions.use-case';
import { BulkUpdateTransactionsUseCase } from '../application/bulk-update-transactions.use-case';
import { BulkDeleteTransactionsUseCase } from '../application/bulk-delete-transactions.use-case';
import { CreateTransferUseCase } from '../application/create-transfer.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { resolvePending } from '../domain/pending-rule';
import {
  IsString,
  IsOptional,
  IsNumberString,
  IsDateString,
  IsBoolean,
  IsObject,
  IsArray,
  ValidateNested,
  IsUUID,
  ArrayMaxSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { Inject } from '@nestjs/common';
import { parseCents } from '../../shared/domain/cents';
import { IsCents } from '../../shared/infrastructure/is-cents.decorator';

export class CreateTransactionDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Account ID', required: false })
  accountId?: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ description: 'Category ID', required: false, nullable: true })
  categoryId: string | null;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ description: 'Period ID', required: false, nullable: true })
  periodId?: string | null;

  @IsDateString()
  @ApiProperty({ description: 'Transaction date' })
  date: string;

  @IsString()
  @ApiProperty({ description: 'Description' })
  description: string;

  @IsCents()
  @ApiProperty({ description: 'Amount in cents' })
  amount: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: 'Reconciled status', required: false })
  reconciled?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: 'Pending status', required: false })
  pending?: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Payment method', required: false })
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Notes', required: false })
  notes?: string;

  @IsOptional()
  @IsObject()
  @ApiProperty({ description: 'Additional metadata', required: false })
  metadata?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ApiProperty({
    description: 'Tag IDs associated with the transaction',
    required: false,
    type: [String],
  })
  tagIds?: string[];

  @IsOptional()
  @IsUUID()
  @ApiProperty({
    description:
      'Savings Goal ID if the transaction is linked to a savings goal',
    required: false,
  })
  savingsGoalId?: string;
}

// accountId vient de l'URL, jamais du body.
export class CreateTransactionBodyDto extends OmitType(CreateTransactionDto, [
  'accountId',
] as const) {}

export class UpdateTransactionDto extends PartialType(
  CreateTransactionBodyDto,
) {}

export class CreateTransferDto {
  @IsUUID()
  @ApiProperty({ description: 'Destination Account ID' })
  destinationAccountId: string;

  @IsDateString()
  @ApiProperty({ description: 'Transfer date' })
  date: string;

  @IsString()
  @ApiProperty({ description: 'Description' })
  description: string;

  @IsCents()
  @ApiProperty({ description: 'Amount in cents (must be positive)' })
  amount: string;
}

export class BulkCreateTransactionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDto)
  @ApiProperty({ type: [CreateTransactionDto] })
  transactions: CreateTransactionDto[];
}

export class BulkUpdateTransactionsDataDto {
  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false, nullable: true })
  categoryId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ApiProperty({ required: false, type: [String] })
  tagIds?: string[];

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  reconciled?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  pending?: boolean;
}

export class BulkUpdateTransactionsDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ApiProperty({ type: [String] })
  ids: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => BulkUpdateTransactionsDataDto)
  @ApiProperty({ type: BulkUpdateTransactionsDataDto })
  data: BulkUpdateTransactionsDataDto;
}

export class BulkDeleteTransactionsDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ApiProperty({ type: [String] })
  ids: string[];
}

export class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  accountId: string;

  @ApiProperty({ nullable: true })
  categoryId: string | null;

  @ApiProperty({ nullable: true })
  periodId: string | null;

  @ApiProperty()
  date: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  reconciled: boolean;

  @ApiProperty()
  pending: boolean;

  @ApiProperty({ nullable: true })
  paymentMethod: string | null;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty()
  metadata: Record<string, any>;

  @ApiProperty({ type: [String] })
  tagIds: string[];

  @ApiProperty({ nullable: true })
  savingsGoalId: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class PredictionResponseDto {
  @ApiProperty({ nullable: true })
  categoryId: string | null;
}

export const MAX_PREDICTIONS_PER_REQUEST = 1000;

export class PredictCategoriesDto {
  @ApiProperty({ type: [String], maxItems: MAX_PREDICTIONS_PER_REQUEST })
  @IsArray()
  @ArrayMaxSize(MAX_PREDICTIONS_PER_REQUEST)
  @IsString({ each: true })
  descriptions: string[];
}

export class PredictCategoriesResponseDto {
  @ApiProperty({ type: [PredictionResponseDto] })
  predictions: PredictionResponseDto[];
}

export class PaginatedTransactionsResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  data: TransactionResponseDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class FindTransactionsQueryDto {
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }): string[] | undefined => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') {
      return value.includes(',') ? value.split(',') : [value];
    }
    return [String(value)];
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ApiProperty({ required: false, type: [String] })
  tagIds?: string[];

  @IsOptional()
  @IsNumberString()
  minAmount?: string;

  @IsOptional()
  @IsNumberString()
  maxAmount?: string;

  @IsOptional()
  @Transform(({ value }): boolean | string | undefined => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as string | undefined;
  })
  @IsBoolean()
  reconciled?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(':accountId/transactions')
export class TransactionsController {
  constructor(
    private readonly getTransactionsByAccountUseCase: GetTransactionsByAccountUseCase,
    private readonly createTransactionUseCase: CreateTransactionUseCase,
    private readonly bulkCreateTransactionsUseCase: BulkCreateTransactionsUseCase,
    private readonly bulkUpdateTransactionsUseCase: BulkUpdateTransactionsUseCase,
    private readonly bulkDeleteTransactionsUseCase: BulkDeleteTransactionsUseCase,
    private readonly createTransferUseCase: CreateTransferUseCase,
    private readonly predictCategoryUseCase: PredictCategoryUseCase,
    private readonly transactionRepository: TransactionRepository,
    @Inject(PeriodRepository)
    private readonly periodRepository: PeriodRepository,
    private readonly references: AccountReferencesService,
  ) {}

  @Get('predict-category')
  @ApiOperation({
    summary: 'Predict category based on transaction description',
  })
  @ApiResponse({ status: 200, type: PredictionResponseDto })
  async predictCategory(
    @Param('accountId') accountId: string,
    @Query('description') description: string,
  ): Promise<PredictionResponseDto> {
    return this.predictCategoryUseCase.execute(accountId, description);
  }

  @Post('predict-categories')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Predict categories for several descriptions (same result as predict-category, history read once)',
  })
  @ApiResponse({ status: 200, type: PredictCategoriesResponseDto })
  async predictCategories(
    @Param('accountId') accountId: string,
    @Body() dto: PredictCategoriesDto,
  ): Promise<PredictCategoriesResponseDto> {
    return {
      predictions: await this.predictCategoryUseCase.executeMany(
        accountId,
        dto.descriptions,
      ),
    };
  }

  @Get()
  @ApiOperation({
    summary:
      'Get all transactions for this account, optionally filtered by period',
  })
  @ApiResponse({ status: 200, type: PaginatedTransactionsResponseDto })
  async findAll(
    @Param('accountId') accountId: string,
    @Query() query: FindTransactionsQueryDto,
  ): Promise<PaginatedTransactionsResponseDto> {
    let startDate = query.startDate
      ? parseDateOnly(query.startDate)
      : undefined;
    let endDate = query.endDate ? parseDateOnly(query.endDate) : undefined;

    if (query.periodId) {
      const period = ensureBelongsToAccount(
        await this.periodRepository.findById(query.periodId),
        accountId,
        'Period',
      );
      startDate = period.startDate;
      endDate = period.endDate || undefined;
    }

    const result = await this.getTransactionsByAccountUseCase.execute(
      accountId,
      {
        startDate,
        endDate,
        search: query.search,
        categoryId: query.categoryId,
        tagIds: query.tagIds,
        minAmount: query.minAmount ? BigInt(query.minAmount) : undefined,
        maxAmount: query.maxAmount ? BigInt(query.maxAmount) : undefined,
        reconciled: query.reconciled,
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
      },
    );
    return {
      data: result.data.map((t) => this.mapToResponse(t)),
      meta: result.meta,
    };
  }

  // Les routes statiques `bulk` doivent rester déclarées AVANT `:id`, sinon
  // Express les fait correspondre à `:id` avec id = "bulk".
  @Patch('bulk')
  @ApiOperation({ summary: 'Update multiple transactions at once' })
  @ApiResponse({ status: 200 })
  async updateBulk(
    @Param('accountId') accountId: string,
    @Body() dto: BulkUpdateTransactionsDto,
  ): Promise<void> {
    await this.bulkUpdateTransactionsUseCase.execute({
      accountId,
      ids: dto.ids,
      data: dto.data,
    });
  }

  @Delete('bulk')
  @ApiOperation({ summary: 'Delete multiple transactions at once' })
  @ApiResponse({ status: 200 })
  async deleteBulk(
    @Param('accountId') accountId: string,
    @Body() dto: BulkDeleteTransactionsDto,
  ): Promise<void> {
    await this.bulkDeleteTransactionsUseCase.execute({
      accountId,
      ids: dto.ids,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction partialy' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  async update(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const existing = ensureBelongsToAccount(
      await this.transactionRepository.findById(id),
      accountId,
      'Transaction',
    );

    // Seules les références réellement fournies sont vérifiées.
    await this.references.ensureReferences(accountId, {
      categoryId: dto.categoryId,
      tagIds: dto.tagIds,
      savingsGoalId: dto.savingsGoalId,
      periodId: dto.periodId,
    });

    // Pointer sort de l'attente (règle partagée avec la modification en lot)
    const pending = resolvePending(
      dto.reconciled,
      dto.pending,
      existing.pending,
    );

    // Le DTO transformé porte toutes ses clés (undefined si absentes) :
    // on ne garde que les champs réellement fournis.
    const provided = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as Partial<Omit<UpdateTransactionDto, 'date' | 'amount'>>;

    const updated = new Transaction({
      ...existing,
      ...provided,
      pending,
      date: dto.date !== undefined ? parseDateOnly(dto.date) : existing.date,
      amount:
        dto.amount !== undefined ? parseCents(dto.amount) : existing.amount,
      updatedAt: new Date(),
    });

    const stored = await this.transactionRepository.save(updated);
    return this.mapToResponse(stored);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a transaction' })
  async delete(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
  ): Promise<void> {
    ensureBelongsToAccount(
      await this.transactionRepository.findById(id),
      accountId,
      'Transaction',
    );
    await this.transactionRepository.delete(id);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple transactions at once' })
  @ApiResponse({ status: 201, type: [TransactionResponseDto] })
  async createBulk(
    @Param('accountId') accountId: string,
    @Body() dto: BulkCreateTransactionsDto,
  ): Promise<TransactionResponseDto[]> {
    const transactions = await this.bulkCreateTransactionsUseCase.execute({
      accountId,
      transactions: dto.transactions.map((t) => ({
        ...t,
        date: parseDateOnly(t.date),
        amount: parseCents(t.amount),
      })),
    });
    return transactions.map((t) => this.mapToResponse(t));
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Create a transfer between two accounts' })
  @ApiResponse({ status: 201, type: [TransactionResponseDto] })
  async createTransfer(
    @Param('accountId') accountId: string,
    @Body() dto: CreateTransferDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<TransactionResponseDto[]> {
    const [sourceTx, destTx] = await this.createTransferUseCase.execute({
      userId: req.user.id,
      sourceAccountId: accountId,
      destinationAccountId: dto.destinationAccountId,
      amount: parseCents(dto.amount),
      date: parseDateOnly(dto.date),
      description: dto.description,
    });
    return [this.mapToResponse(sourceTx), this.mapToResponse(destTx)];
  }

  @Post()
  @ApiOperation({ summary: 'Create a new transaction for this account' })
  @ApiResponse({ status: 201, type: TransactionResponseDto })
  async create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateTransactionBodyDto,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.createTransactionUseCase.execute({
      ...dto,
      accountId,
      date: parseDateOnly(dto.date),
      amount: parseCents(dto.amount),
    });
    return this.mapToResponse(transaction);
  }

  private mapToResponse(t: Transaction): TransactionResponseDto {
    return {
      id: t.id,
      accountId: t.accountId,
      categoryId: t.categoryId || null,
      periodId: t.periodId || null,
      date: t.date.toISOString(),
      description: t.description,
      amount: t.amount.toString(),
      reconciled: t.reconciled,
      pending: t.pending,
      paymentMethod: t.paymentMethod || null,
      notes: t.notes || null,
      metadata: t.metadata || {},
      tagIds: t.tagIds || [],
      savingsGoalId: t.savingsGoalId || null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
