import {
  Body,
  Controller,
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
  constructor(private readonly saveUseCase: SaveBudgetTemplatesUseCase) {}

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
