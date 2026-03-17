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
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { 
  GetSavingsGoalsUseCase, 
  CreateSavingsGoalUseCase, 
  UpdateSavingsGoalUseCase 
} from '../application/savings-goals.use-cases';
import type { SavingsGoalRepository } from '../domain/savings-goal.repository.interface';
import { IsString, IsOptional, IsDateString, IsNumberString } from 'class-validator';
import { Inject } from '@nestjs/common';

class CreateSavingsGoalDto {
  @IsString()
  @ApiProperty()
  name: string;

  @IsNumberString()
  @ApiProperty()
  targetAmount: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false })
  deadline?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  color?: string;
}

class UpdateSavingsGoalDto {
  @IsOptional() @IsString() @ApiProperty({ required: false }) name?: string;
  @IsOptional() @IsNumberString() @ApiProperty({ required: false }) targetAmount?: string;
  @IsOptional() @IsNumberString() @ApiProperty({ required: false }) currentAmount?: string;
  @IsOptional() @IsDateString() @ApiProperty({ required: false }) deadline?: string | null;
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
    @Inject('SavingsGoalRepository')
    private readonly repository: SavingsGoalRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all savings goals' })
  async findAll(@Param('accountId') accountId: string) {
    const goals = await this.getSavingsGoalsUseCase.execute(accountId);
    return goals.map(g => this.mapToResponse(g));
  }

  @Post()
  @ApiOperation({ summary: 'Create a savings goal' })
  async create(@Param('accountId') accountId: string, @Body() dto: CreateSavingsGoalDto) {
    const goal = await this.createSavingsGoalUseCase.execute({ ...dto, accountId });
    return this.mapToResponse(goal);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a savings goal' })
  async update(@Param('id') id: string, @Body() dto: UpdateSavingsGoalDto) {
    const goal = await this.updateSavingsGoalUseCase.execute({ ...dto, id });
    return this.mapToResponse(goal);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a savings goal' })
  async remove(@Param('id') id: string) {
    await this.repository.delete(id);
  }

  private mapToResponse(g: any) {
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
