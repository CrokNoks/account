import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Delete,
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
import { GetRecurringTransactionsUseCase } from '../application/get-recurring-transactions.use-case';
import { CreateRecurringTransactionUseCase } from '../application/create-recurring-transaction.use-case';
import { UpdateRecurringTransactionUseCase } from '../application/update-recurring-transaction.use-case';
import { DeleteRecurringTransactionUseCase } from '../application/delete-recurring-transaction.use-case';
import { RecurringTransaction } from '../domain/recurring-transaction.entity';
import {
  IsString,
  IsOptional,
  IsNumberString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateRecurringTransactionDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  categoryId: string | null;

  @IsString()
  @ApiProperty()
  description: string;

  @IsNumberString()
  @ApiProperty({ description: 'Amount in cents' })
  amount: string;

  @IsInt()
  @Min(1)
  @Max(31)
  @ApiProperty({ description: 'Day of the month (1-31)' })
  dayOfMonth: number;
}

export class UpdateRecurringTransactionDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  description?: string;

  @IsOptional()
  @IsNumberString()
  @ApiProperty({ required: false, description: 'Amount in cents' })
  amount?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  @ApiProperty({ required: false, description: 'Day of the month (1-31)' })
  dayOfMonth?: number;
}

export class RecurringTransactionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() accountId: string;
  @ApiProperty({ nullable: true }) categoryId: string | null;
  @ApiProperty() description: string;
  @ApiProperty() amount: string;
  @ApiProperty() dayOfMonth: number;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

@ApiTags('recurring-transactions')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(':accountId/recurring')
export class RecurringController {
  constructor(
    private readonly getRecurringUseCase: GetRecurringTransactionsUseCase,
    private readonly createRecurringUseCase: CreateRecurringTransactionUseCase,
    private readonly updateRecurringUseCase: UpdateRecurringTransactionUseCase,
    private readonly deleteRecurringUseCase: DeleteRecurringTransactionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all recurring transactions for an account' })
  @ApiResponse({ status: 200, type: [RecurringTransactionResponseDto] })
  async findAll(
    @Param('accountId') accountId: string,
  ): Promise<RecurringTransactionResponseDto[]> {
    const transactions = await this.getRecurringUseCase.execute(accountId);
    return transactions.map((t) => this.mapToResponse(t));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new recurring transaction' })
  @ApiResponse({ status: 201, type: RecurringTransactionResponseDto })
  async create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    const transaction = await this.createRecurringUseCase.execute({
      ...dto,
      accountId,
      amount: BigInt(Math.round(Number(dto.amount))),
    });
    return this.mapToResponse(transaction);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a recurring transaction' })
  @ApiResponse({ status: 200, type: RecurringTransactionResponseDto })
  async update(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    // Le DTO transformé porte toutes ses clés (valeur undefined si absentes) :
    // on ne garde que les champs réellement fournis.
    const data = {
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.dayOfMonth !== undefined && { dayOfMonth: dto.dayOfMonth }),
      ...(dto.amount !== undefined && {
        amount: BigInt(Math.round(Number(dto.amount))),
      }),
    };
    const transaction = await this.updateRecurringUseCase.execute(
      accountId,
      id,
      data,
    );
    return this.mapToResponse(transaction);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a recurring transaction' })
  @ApiResponse({ status: 204 })
  async delete(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.deleteRecurringUseCase.execute(accountId, id);
  }

  private mapToResponse(
    t: RecurringTransaction,
  ): RecurringTransactionResponseDto {
    return {
      id: t.id,
      accountId: t.accountId,
      categoryId: t.categoryId,
      description: t.description,
      amount: t.amount.toString(),
      dayOfMonth: t.dayOfMonth,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
