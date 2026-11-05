import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import {
  GetBudgetTemplatesUseCase,
  BudgetTemplateView,
} from '../application/get-budget-templates.use-case';
import { SaveBudgetTemplatesUseCase } from '../application/save-budget-templates.use-case';
import { parseCents } from '../../shared/domain/cents';
import { IsCents } from '../../shared/infrastructure/is-cents.decorator';

export class BudgetTemplateItemDto {
  @IsUUID()
  @ApiProperty()
  categoryId: string;

  @IsCents()
  @ApiProperty({ description: 'Fixed amount in cents (stringified BigInt)' })
  amount: string;
}

export class SaveBudgetTemplatesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BudgetTemplateItemDto)
  @ApiProperty({ type: [BudgetTemplateItemDto] })
  items: BudgetTemplateItemDto[];
}

@ApiTags('budget-templates')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(':accountId/budget-templates')
export class BudgetTemplatesController {
  constructor(
    private readonly saveUseCase: SaveBudgetTemplatesUseCase,
    private readonly getUseCase: GetBudgetTemplatesUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List every category with its fixed amount (or a proposal from recurring transactions)',
  })
  @ApiResponse({ status: 200 })
  async list(
    @Param('accountId') accountId: string,
  ): Promise<BudgetTemplateView[]> {
    return this.getUseCase.execute(accountId);
  }

  @Put()
  @HttpCode(204)
  @ApiOperation({ summary: 'Save the fixed budget amounts of the account' })
  @ApiResponse({ status: 204 })
  async save(
    @Param('accountId') accountId: string,
    @Body() dto: SaveBudgetTemplatesDto,
  ): Promise<void> {
    await this.saveUseCase.execute({
      accountId,
      items: dto.items.map((i) => ({
        categoryId: i.categoryId,
        amount: parseCents(i.amount),
      })),
    });
  }
}
