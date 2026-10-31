import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
  OmitType,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { GetCategoriesUseCase } from '../application/get-categories.use-case';
import { CreateCategoryUseCase } from '../application/create-category.use-case';
import { Category, CategoryType } from '../domain/category.entity';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsHexColor,
  MaxLength,
} from 'class-validator';
import { CategoryRepository } from '../domain/category.repository.interface';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import { parseCents } from '../../shared/domain/cents';
import { IsCents } from '../../shared/infrastructure/is-cents.decorator';

export class CreateCategoryDto {
  @IsString()
  @ApiProperty({ description: 'Name of the category' })
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Description of the category', required: false })
  description?: string;

  @IsHexColor()
  @ApiProperty({ description: 'Hex color code' })
  color: string;

  @IsEnum(CategoryType)
  @ApiProperty({ enum: CategoryType, description: 'Type of category' })
  type: CategoryType;

  @IsString()
  @ApiProperty({ description: 'Account ID this category belongs to' })
  accountId: string;

  @IsOptional()
  @IsCents()
  @ApiProperty({
    description: 'Budget limit in cents (optional)',
    required: false,
  })
  budget?: string; // We accept it as a string to handle BigInt
}

// accountId vient de l'URL, jamais du body.
export class CreateCategoryBodyDto extends OmitType(CreateCategoryDto, [
  'accountId',
] as const) {}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @ApiProperty({ required: false }) name?: string;
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  description?: string;
  @IsOptional() @IsHexColor() @ApiProperty({ required: false }) color?: string;
  @IsOptional()
  @IsEnum(CategoryType)
  @ApiProperty({ enum: CategoryType, required: false })
  type?: CategoryType;
  @IsOptional()
  @IsCents()
  @ApiProperty({ required: false })
  budget?: string;
}

export class CategoryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ required: false, nullable: true }) description: string | null;
  @ApiProperty() color: string;
  @ApiProperty({ enum: CategoryType }) type: CategoryType;
  @ApiProperty({ required: false, nullable: true }) accountId: string | null;
  @ApiProperty({ required: false, nullable: true }) budget: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(':accountId/categories')
export class CategoriesController {
  constructor(
    private readonly getCategoriesUseCase: GetCategoriesUseCase,
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories for this account' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  async findAll(
    @Param('accountId') accountId: string,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.getCategoriesUseCase.execute(accountId);
    return categories.map((c) => this.mapToResponse(c));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  async update(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    // Une catégorie globale (accountId null) n'appartient à aucun compte :
    // elle n'est pas modifiable depuis un compte (404).
    const existing = ensureBelongsToAccount(
      await this.categoryRepository.findById(id),
      accountId,
      'Category',
    );

    const updated = new Category({
      id: existing.id,
      name: dto.name ?? existing.name,
      description: dto.description ?? existing.description,
      color: dto.color ?? existing.color,
      type: dto.type ?? existing.type,
      accountId: existing.accountId,
      budget: dto.budget ? parseCents(dto.budget) : existing.budget,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.categoryRepository.save(updated);
    return this.mapToResponse(updated);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new category for this account' })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  async create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateCategoryBodyDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.createCategoryUseCase.execute({
      ...dto,
      accountId,
      budget: dto.budget ? parseCents(dto.budget) : null,
    });

    return this.mapToResponse(category);
  }

  private mapToResponse(c: Category): CategoryResponseDto {
    return {
      id: c.id,
      name: c.name,
      description: c.description || null,
      color: c.color,
      type: c.type,
      accountId: c.accountId || null,
      budget: c.budget ? c.budget.toString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
