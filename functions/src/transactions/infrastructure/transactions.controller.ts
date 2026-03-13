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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { GetTransactionsByAccountUseCase } from '../application/get-transactions-by-account.use-case';
import { CreateTransactionUseCase } from '../application/create-transaction.use-case';
import { PredictCategoryUseCase } from '../application/predict-category.use-case';
import { BulkCreateTransactionsUseCase } from '../application/bulk-create-transactions.use-case';
import { CreateTransferUseCase } from '../application/create-transfer.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import {
  IsString,
  IsOptional,
  IsNumberString,
  IsDateString,
  IsBoolean,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransactionDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Account ID', required: false })
  accountId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Category ID', required: false, nullable: true })
  categoryId: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Period ID', required: false, nullable: true })
  periodId?: string | null;

  @IsDateString()
  @ApiProperty({ description: 'Transaction date' })
  date: string;

  @IsString()
  @ApiProperty({ description: 'Description' })
  description: string;

  @IsNumberString()
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
  @IsString({ each: true })
  @ApiProperty({
    description: 'Tag IDs associated with the transaction',
    required: false,
    type: [String],
  })
  tagIds?: string[];
}

export class CreateTransferDto {
  @IsString()
  @ApiProperty({ description: 'Destination Account ID' })
  destinationAccountId: string;

  @IsDateString()
  @ApiProperty({ description: 'Transfer date' })
  date: string;

  @IsString()
  @ApiProperty({ description: 'Description' })
  description: string;

  @IsNumberString()
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

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class PredictionResponseDto {
  @ApiProperty({ nullable: true })
  categoryId: string | null;
}

export class FindTransactionsQueryDto {
  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @ApiProperty({ required: false, type: [String] })
  tagIds?: string[];

  @IsOptional()
  @IsNumberString()
  minAmount?: string;

  @IsOptional()
  @IsNumberString()
  maxAmount?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  reconciled?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
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
    private readonly createTransferUseCase: CreateTransferUseCase,
    private readonly predictCategoryUseCase: PredictCategoryUseCase,
    private readonly transactionRepository: TransactionRepository,
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

  @Get()
  @ApiOperation({
    summary:
      'Get all transactions for this account, optionally filtered by period',
  })
  @ApiResponse({ status: 200, type: [TransactionResponseDto] })
  async findAll(
    @Param('accountId') accountId: string,
    @Query() query: FindTransactionsQueryDto,
  ): Promise<TransactionResponseDto[]> {
    if (query.periodId) {
      const transactions =
        await this.transactionRepository.findAllByPeriod(query.periodId);
      return transactions
        .filter((t) => t.accountId === accountId)
        .map((t) => this.mapToResponse(t));
    }

    const transactions = await this.getTransactionsByAccountUseCase.execute(
      accountId,
      {
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        search: query.search,
        categoryId: query.categoryId,
        tagIds: query.tagIds,
        minAmount: query.minAmount ? BigInt(query.minAmount) : undefined,
        maxAmount: query.maxAmount ? BigInt(query.maxAmount) : undefined,
        reconciled: query.reconciled,
      },
    );
    return transactions.map((t) => this.mapToResponse(t));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction partialy' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  async update(
    @Param('id') id: string,
    @Body()
    dto: Partial<CreateTransactionDto> & {
      reconciled?: boolean;
      pending?: boolean;
    },
  ): Promise<TransactionResponseDto> {
    const existing = await this.transactionRepository.findById(id);
    if (!existing) throw new Error('Transaction not found');

    // If reconciling, auto-clear pending
    const pending =
      dto.reconciled === true ? false : (dto.pending ?? existing.pending);

    const updated = new Transaction({
      ...existing,
      ...dto,
      pending,
      tagIds: dto.tagIds !== undefined ? dto.tagIds : existing.tagIds,
      date: dto.date ? new Date(dto.date) : existing.date,
      amount: dto.amount
        ? BigInt(Math.round(Number(dto.amount)))
        : existing.amount,
      updatedAt: new Date(),
    });

    await this.transactionRepository.save(updated);
    return this.mapToResponse(updated);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a transaction' })
  async delete(@Param('id') id: string): Promise<void> {
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
        date: new Date(t.date),
        amount: BigInt(Math.round(Number(t.amount))),
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
  ): Promise<TransactionResponseDto[]> {
    const [sourceTx, destTx] = await this.createTransferUseCase.execute({
      sourceAccountId: accountId,
      destinationAccountId: dto.destinationAccountId,
      amount: BigInt(Math.round(Number(dto.amount))),
      date: new Date(dto.date),
      description: dto.description,
    });
    return [this.mapToResponse(sourceTx), this.mapToResponse(destTx)];
  }

  @Post()
  @ApiOperation({ summary: 'Create a new transaction for this account' })
  @ApiResponse({ status: 201, type: TransactionResponseDto })
  async create(
    @Param('accountId') accountId: string,
    @Body() dto: Omit<CreateTransactionDto, 'accountId'>,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.createTransactionUseCase.execute({
      ...dto,
      accountId,
      date: new Date(dto.date),
      amount: BigInt(Math.round(Number(dto.amount))),
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
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
