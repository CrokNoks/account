import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Patch,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import {
  GetSavingsGoalsUseCase,
  CreateSavingsGoalUseCase,
  UpdateSavingsGoalUseCase,
  DeleteSavingsGoalUseCase,
} from '../application/savings-goals.use-cases';
import { SavingsGoal } from '../domain/savings-goal.entity';
import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { IsCents } from '../../shared/infrastructure/is-cents.decorator';
import { IsCalendarDate } from '../../shared/infrastructure/is-calendar-date.decorator';

class CreateSavingsGoalDto {
  @IsString()
  @MaxLength(255)
  @Matches(/\S/, { message: 'name must not be blank' })
  @ApiProperty()
  name: string;

  @IsCents()
  @ApiProperty()
  targetAmount: string;

  @IsOptional()
  @IsCalendarDate()
  @ApiProperty({ required: false })
  deadline?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  color?: string;
}

class UpdateSavingsGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/\S/, { message: 'name must not be blank' })
  @ApiProperty({ required: false })
  name?: string;
  @IsOptional()
  @IsCents()
  @ApiProperty({ required: false })
  targetAmount?: string;
  @IsOptional()
  @IsCents()
  @ApiProperty({ required: false })
  currentAmount?: string;
  @IsOptional() @IsCalendarDate() @ApiProperty({ required: false }) deadline?:
    | string
    | null;
  @IsOptional() @IsString() @ApiProperty({ required: false }) color?: string;
}

@ApiTags('savings-goals')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(':accountId/savings-goals')
export class SavingsGoalsController {
  constructor(
    private readonly getSavingsGoalsUseCase: GetSavingsGoalsUseCase,
    private readonly createSavingsGoalUseCase: CreateSavingsGoalUseCase,
    private readonly updateSavingsGoalUseCase: UpdateSavingsGoalUseCase,
    private readonly deleteSavingsGoalUseCase: DeleteSavingsGoalUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all savings goals' })
  async findAll(@Param('accountId') accountId: string) {
    const goals = await this.getSavingsGoalsUseCase.execute(accountId);
    return goals.map((g) => this.mapToResponse(g));
  }

  @Post()
  @ApiOperation({ summary: 'Create a savings goal' })
  async create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateSavingsGoalDto,
  ) {
    const goal = await this.createSavingsGoalUseCase.execute({
      ...dto,
      accountId,
    });
    return this.mapToResponse(goal);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a savings goal' })
  async update(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSavingsGoalDto,
  ) {
    const goal = await this.updateSavingsGoalUseCase.execute({
      ...dto,
      accountId,
      id,
    });
    return this.mapToResponse(goal);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a savings goal' })
  async remove(@Param('accountId') accountId: string, @Param('id') id: string) {
    await this.deleteSavingsGoalUseCase.execute(accountId, id);
  }

  private mapToResponse(g: SavingsGoal) {
    return {
      id: g.id,
      accountId: g.accountId,
      name: g.name,
      targetAmount: g.targetAmount.toString(),
      currentAmount: g.currentAmount.toString(),
      deadline: g.deadline?.toISOString() || null,
      color: g.color,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    };
  }
}
