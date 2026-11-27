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
import { UpdateTransferUseCase } from '../application/update-transfer.use-case';
import { CreateTransferUseCase } from '../application/create-transfer.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { isLeavingPending, resolvePending } from '../domain/pending-rule';
import { ApplyPeriodSwitchService } from '../../periods/application/apply-period-switch.service';
import type { PeriodSwitchInfo } from '../../periods/application/apply-period-switch.service';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
  ValidateNested,
  IsUUID,
  ArrayMaxSize,
  MaxLength,
  Matches,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { IsOptionalNotNull } from '../../shared/infrastructure/is-optional-not-null.decorator';
import { rejectNullFields } from '../../shared/infrastructure/reject-null-fields';
import { Type, Transform } from 'class-transformer';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { Inject } from '@nestjs/common';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { IgnoredLegacyField } from '../../accounts/infrastructure/ignored-legacy-field.decorator';
import {
  toWindowPeriod,
  WindowPeriod,
} from '../../reporting/domain/period-window';
import { parseCents } from '../../shared/domain/cents';
import { IsCents } from '../../shared/infrastructure/is-cents.decorator';
import { IsCalendarDate } from '../../shared/infrastructure/is-calendar-date.decorator';

// Une seule limite pour toute description de transaction (saisie, import, virement, prédiction).
// Colonne `transactions.description` : text, sans plafond en base ; 1000 couvre les libellés
// bancaires multi-lignes (jusqu'à ~350 caractères constatés) avec de la marge.
export const MAX_TRANSACTION_DESCRIPTION = 1000;

export class CreateTransactionDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Account ID', required: false })
  accountId?: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ description: 'Category ID', required: false, nullable: true })
  categoryId: string | null;

  // Retiré (la période se déduit des dates) mais encore envoyé par un front en cache : accepté puis ignoré.
  @IgnoredLegacyField() periodId?: unknown;

  @IsCalendarDate()
  @ApiProperty({ description: 'Transaction date' })
  date: string;

  @IsString()
  @ApiProperty({ description: 'Description' })
  @MaxLength(MAX_TRANSACTION_DESCRIPTION)
  @Matches(/\S/, { message: 'Description is required' })
  description: string;

  @IsCents()
  @ApiProperty({ description: 'Amount in cents' })
  amount: string;

  @IsOptionalNotNull()
  @IsBoolean()
  @ApiProperty({ description: 'Reconciled status', required: false })
  reconciled?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  @ApiProperty({ description: 'Pending status', required: false })
  pending?: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Notes', required: false })
  notes?: string;

  @IsOptionalNotNull()
  @IsObject()
  @ApiProperty({ description: 'Additional metadata', required: false })
  metadata?: Record<string, any>;

  @IsOptionalNotNull()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ApiProperty({
    description: 'Tag IDs associated with the transaction',
    required: false,
    type: [String],
  })
  tagIds?: string[];
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

  @IsCalendarDate()
  @ApiProperty({ description: 'Transfer date' })
  date: string;

  @IsString()
  @ApiProperty({ description: 'Description' })
  @MaxLength(MAX_TRANSACTION_DESCRIPTION)
  @Matches(/\S/, { message: 'Description is required' })
  description: string;

  @IsCents()
  @ApiProperty({ description: 'Amount in cents (must be positive)' })
  amount: string;
}

/** Comptage de l'écran d'import (mesure seulement : journalisé, sans effet sur l'écriture). */
export class ImportStatsDto {
  @IsInt()
  @Min(0)
  @Max(100000)
  @ApiProperty({ description: 'Lines unchecked by default (already present)' })
  excluded: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  @ApiProperty({ description: 'Unchecked lines checked again and sent' })
  rechecked: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  @ApiProperty({ description: 'Lines flagged as close to an existing one' })
  closeFlagged: number;
}

export class BulkCreateTransactionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDto)
  @ApiProperty({ type: [CreateTransactionDto] })
  transactions: CreateTransactionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ImportStatsDto)
  @ApiProperty({ type: ImportStatsDto, required: false })
  importStats?: ImportStatsDto;
}

export class BulkUpdateTransactionsDataDto {
  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false, nullable: true })
  categoryId?: string | null;

  @IsOptionalNotNull()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ApiProperty({ required: false, type: [String] })
  tagIds?: string[];

  @IsOptionalNotNull()
  @IsBoolean()
  @ApiProperty({ required: false })
  reconciled?: boolean;

  @IsOptionalNotNull()
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

export class PeriodSwitchDto {
  @ApiProperty({ description: 'Période clôturée' })
  closed: { id: string; startDate: string; endDate: string };

  @ApiProperty({ description: 'Période ouverte' })
  opened: { id: string; startDate: string; endDate: string };

  @ApiProperty({ description: 'Nombre de bascules (import : plusieurs)' })
  count: number;

  @ApiProperty({
    description: 'La transaction a pris la date du jour en sortant du pending',
  })
  dateChanged: boolean;

  @ApiProperty({
    required: false,
    description:
      'Import : `pending` récurrentes supprimées car leur équivalent est importé',
  })
  removedPending?: number;

  @ApiProperty({
    required: false,
    description:
      'Import : récurrentes encore `pending` datées dans la période close',
  })
  remainingPending?: number;
}

export class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  accountId: string;

  @ApiProperty({ nullable: true })
  categoryId: string | null;

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
  notes: string | null;

  @ApiProperty()
  metadata: Record<string, any>;

  @ApiProperty({ type: [String] })
  tagIds: string[];

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({
    type: PeriodSwitchDto,
    required: false,
    description:
      'Présent seulement si cette requête a clos la période active et en a ouvert une',
  })
  periodSwitch?: PeriodSwitchInfo;
}

export class BulkUpdateResponseDto {
  @ApiProperty({ type: PeriodSwitchDto, required: false })
  periodSwitch?: PeriodSwitchInfo;
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
  @MaxLength(MAX_TRANSACTION_DESCRIPTION, { each: true })
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
  @MaxLength(200)
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
  ids?: string[];

  @IsOptional()
  @IsCents()
  minAmount?: string;

  @IsOptional()
  @IsCents()
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
  @Transform(({ value }): boolean | string | undefined => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as string | undefined;
  })
  @IsBoolean()
  pending?: boolean;

  @IsOptional()
  @IsCalendarDate()
  startDate?: string;

  @IsOptional()
  @IsCalendarDate()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
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
    private readonly updateTransferUseCase: UpdateTransferUseCase,
    private readonly predictCategoryUseCase: PredictCategoryUseCase,
    private readonly transactionRepository: TransactionRepository,
    @Inject(PeriodRepository)
    private readonly periodRepository: PeriodRepository,
    @Inject(CategoryRepository)
    private readonly categoryRepository: CategoryRepository,
    private readonly references: AccountReferencesService,
    private readonly periodSwitch: ApplyPeriodSwitchService,
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
    const startDate = query.startDate
      ? parseDateOnly(query.startDate)
      : undefined;
    const endDate = query.endDate ? parseDateOnly(query.endDate) : undefined;
    let periodWindow: WindowPeriod | undefined;

    if (query.periodId) {
      const period = ensureBelongsToAccount(
        await this.periodRepository.findById(query.periodId),
        accountId,
        'Period',
      );
      // startDate/endDate saisis restreignent la fenêtre de la période (ET,
      // jamais un élargissement) ; sa fenêtre (la même que le prévu, prochaine
      // paie exclue) est appliquée par le dépôt, pas une borne de fin.
      periodWindow = toWindowPeriod(
        period,
        await this.categoryRepository.findAllByAccount(accountId),
      );
    }

    const result = await this.getTransactionsByAccountUseCase.execute(
      accountId,
      {
        startDate,
        endDate,
        periodWindow,
        search: query.search,
        categoryId: query.categoryId,
        tagIds: query.tagIds,
        ids: query.ids,
        minAmount: query.minAmount ? parseCents(query.minAmount) : undefined,
        maxAmount: query.maxAmount ? parseCents(query.maxAmount) : undefined,
        reconciled: query.reconciled,
        pending: query.pending,
        page: query.page,
        limit: query.limit,
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
  @ApiResponse({ status: 200, type: BulkUpdateResponseDto })
  async updateBulk(
    @Param('accountId') accountId: string,
    @Body() dto: BulkUpdateTransactionsDto,
  ): Promise<BulkUpdateResponseDto> {
    const { periodSwitch } = await this.bulkUpdateTransactionsUseCase.execute({
      accountId,
      ids: dto.ids,
      data: dto.data,
    });
    return periodSwitch ? { periodSwitch } : {};
  }

  @Delete('bulk')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete multiple transactions at once' })
  @ApiResponse({ status: 204 })
  async deleteBulk(
    @Param('accountId') accountId: string,
    @Body() dto: BulkDeleteTransactionsDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.bulkDeleteTransactionsUseCase.execute({
      userId: req.user.id,
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
    @Request() req: AuthenticatedRequest,
  ): Promise<TransactionResponseDto> {
    // `null` n'a de sens que pour catégorie, période, moyen de paiement et notes.
    rejectNullFields(dto, [
      'date',
      'amount',
      'description',
      'reconciled',
      'pending',
      'metadata',
      'tagIds',
    ]);

    const existing = ensureBelongsToAccount(
      await this.transactionRepository.findById(id),
      accountId,
      'Transaction',
    );

    // Seules les références réellement fournies sont vérifiées.
    await this.references.ensureReferences(accountId, {
      categoryId: dto.categoryId,
      tagIds: dto.tagIds,
    });

    // Pointer sort de l'attente (règle partagée avec la modification en lot)
    const pending = resolvePending(
      dto.reconciled,
      dto.pending,
      existing.pending,
      existing.reconciled,
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

    // Un côté de virement : montant et date suivent l'autre côté (règle dans
    // UpdateTransferUseCase), jamais de bascule de période.
    if (existing.metadata?.transferId) {
      const stored = await this.updateTransferUseCase.execute({
        userId: req.user.id,
        existing,
        updated,
      });
      return this.mapToResponse(stored);
    }

    // Sortir du pending une paie : date du jour et bascule de période éventuelle
    // (écriture atomique) ; sinon enregistrement comme avant.
    const leaving = isLeavingPending(existing.pending, updated.pending);
    const switched = await this.periodSwitch.process({
      accountId,
      mode: 'update',
      transactions: [updated],
      leavingPendingIds: new Set(leaving ? [updated.id] : []),
    });
    if (switched.written) {
      return this.mapToResponse(
        switched.transactions[0],
        switched.periodSwitch,
      );
    }
    const stored = await this.transactionRepository.save(
      switched.transactions[0],
    );
    return this.mapToResponse(stored);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiResponse({ status: 204 })
  async delete(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    // Même règle que la suppression en lot : l'autre côté d'un virement suit.
    await this.bulkDeleteTransactionsUseCase.deleteOne({
      userId: req.user.id,
      accountId,
      id,
    });
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple transactions at once' })
  @ApiResponse({ status: 201, type: [TransactionResponseDto] })
  async createBulk(
    @Param('accountId') accountId: string,
    @Body() dto: BulkCreateTransactionsDto,
  ): Promise<TransactionResponseDto[]> {
    const { transactions, periodSwitch } =
      await this.bulkCreateTransactionsUseCase.execute({
        accountId,
        transactions: dto.transactions.map((t) => ({
          ...t,
          date: parseDateOnly(t.date),
          amount: parseCents(t.amount),
        })),
        importStats: dto.importStats,
      });
    // Le tableau reste celui d'avant ; la bascule éventuelle est portée par chaque élément.
    return transactions.map((t) => this.mapToResponse(t, periodSwitch));
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
    const { transaction, periodSwitch } =
      await this.createTransactionUseCase.execute({
        ...dto,
        accountId,
        date: parseDateOnly(dto.date),
        amount: parseCents(dto.amount),
      });
    return this.mapToResponse(transaction, periodSwitch);
  }

  private mapToResponse(
    t: Transaction,
    periodSwitch: PeriodSwitchInfo | null = null,
  ): TransactionResponseDto {
    return {
      id: t.id,
      accountId: t.accountId,
      categoryId: t.categoryId || null,
      date: t.date.toISOString(),
      description: t.description,
      amount: t.amount.toString(),
      reconciled: t.reconciled,
      pending: t.pending,
      notes: t.notes || null,
      metadata: t.metadata || {},
      tagIds: t.tagIds || [],
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      ...(periodSwitch ? { periodSwitch } : {}),
    };
  }
}
