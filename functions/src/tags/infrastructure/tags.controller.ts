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
import { CreateTagUseCase } from '../application/create-tag.usecase';
import { UpdateTagUseCase } from '../application/update-tag.usecase';
import { DeleteTagUseCase } from '../application/delete-tag.usecase';
import { FindAccountTagsUseCase } from '../application/find-account-tags.usecase';
import { Tag } from '../domain/tag.entity';
import { IsString, IsHexColor, MaxLength, Matches } from 'class-validator';
import { IsOptionalNotNull } from '../../shared/infrastructure/is-optional-not-null.decorator';

export class CreateTagDto {
  @IsString()
  @ApiProperty({ description: 'Name of the tag' })
  @MaxLength(50)
  @Matches(/\S/, { message: 'name must not be blank' })
  name: string;

  @IsOptionalNotNull()
  @IsHexColor()
  @ApiProperty({
    required: false,
    description: 'Hex color code (default #94a3b8)',
  })
  color?: string;
}

export class UpdateTagDto {
  @IsOptionalNotNull()
  @IsString()
  @ApiProperty({ required: false })
  @MaxLength(50)
  @Matches(/\S/, { message: 'name must not be blank' })
  name?: string;

  @IsOptionalNotNull()
  @IsHexColor()
  @ApiProperty({ required: false })
  color?: string;
}

export class TagResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() accountId: string;
  @ApiProperty() name: string;
  @ApiProperty() color: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

@ApiTags('tags')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(':accountId/tags')
export class TagsController {
  constructor(
    private readonly findAccountTagsUseCase: FindAccountTagsUseCase,
    private readonly createTagUseCase: CreateTagUseCase,
    private readonly updateTagUseCase: UpdateTagUseCase,
    private readonly deleteTagUseCase: DeleteTagUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all tags for this account' })
  @ApiResponse({ status: 200, type: [TagResponseDto] })
  async findAll(
    @Param('accountId') accountId: string,
  ): Promise<TagResponseDto[]> {
    const tags = await this.findAccountTagsUseCase.execute(accountId);
    return tags.map((t) => this.mapToResponse(t));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiResponse({ status: 201, type: TagResponseDto })
  async create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateTagDto,
  ): Promise<TagResponseDto> {
    const tag = await this.createTagUseCase.execute({
      ...dto,
      accountId,
    });
    return this.mapToResponse(tag);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tag' })
  @ApiResponse({ status: 200, type: TagResponseDto })
  async update(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<TagResponseDto> {
    const tag = await this.updateTagUseCase.execute({
      accountId,
      id,
      ...dto,
    });
    return this.mapToResponse(tag);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tag' })
  @ApiResponse({ status: 204 })
  async delete(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.deleteTagUseCase.execute(accountId, id);
  }

  private mapToResponse(t: Tag): TagResponseDto {
    return {
      id: t.id,
      accountId: t.accountId,
      name: t.name,
      color: t.color,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
