import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import type { SmartRuleRepository } from '../domain/smart-rule.repository.interface';
import { SmartRule } from '../domain/smart-rule.entity';
import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';
import { Inject } from '@nestjs/common';

class CreateSmartRuleDto {
  @IsString()
  @ApiProperty()
  pattern: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  categoryId: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, type: [String] })
  tagIds?: string[];

  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: false })
  priority?: number;
}

class UpdateSmartRuleDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  pattern?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  categoryId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, type: [String] })
  tagIds?: string[];

  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: false })
  priority?: number;
}

@ApiTags('smart-rules')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(':accountId/smart-rules')
export class SmartRulesController {
  constructor(
    @Inject('SmartRuleRepository')
    private readonly repository: SmartRuleRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all smart rules' })
  async findAll(@Param('accountId') accountId: string) {
    const rules = await this.repository.findAllByAccount(accountId);
    return rules.map((r) => this.mapToResponse(r));
  }

  @Post()
  @ApiOperation({ summary: 'Create a smart rule' })
  async create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateSmartRuleDto,
  ) {
    const rule = SmartRule.create({
      accountId,
      pattern: dto.pattern,
      categoryId: dto.categoryId || null,
      tagIds: dto.tagIds || [],
      priority: dto.priority || 0,
    });

    await this.repository.save(rule);
    return this.mapToResponse(rule);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a smart rule' })
  async update(@Param('id') id: string, @Body() dto: UpdateSmartRuleDto) {
    const rule = await this.repository.findById(id);
    if (!rule) throw new NotFoundException('Smart rule not found');

    if (dto.pattern !== undefined) rule.updatePattern(dto.pattern);
    if (dto.categoryId !== undefined) rule.updateCategory(dto.categoryId);
    if (dto.tagIds !== undefined) rule.updateTags(dto.tagIds);
    if (dto.priority !== undefined) rule.updatePriority(dto.priority);

    await this.repository.save(rule);
    return this.mapToResponse(rule);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a smart rule' })
  async remove(@Param('id') id: string) {
    await this.repository.delete(id);
  }

  private mapToResponse(r: SmartRule) {
    return {
      id: r.id,
      accountId: r.accountId,
      pattern: r.pattern,
      categoryId: r.categoryId,
      tagIds: r.tagIds,
      priority: r.priority,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
