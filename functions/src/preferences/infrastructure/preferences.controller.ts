import {
  Controller,
  Get,
  Body,
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
} from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsString,
  IsBoolean,
  ValidateNested,
  IsObject,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { GetUserPreferencesUseCase } from '../application/get-user-preferences.use-case';
import { UpdateUserPreferencesUseCase } from '../application/update-user-preferences.use-case';
import { DashboardLayout, DashboardWidgetConfig } from '../domain/user-preferences.entity';

class DashboardWidgetConfigDto implements DashboardWidgetConfig {
  @IsString()
  @ApiProperty()
  id: string;

  @IsNumber()
  @ApiProperty()
  width: number;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ required: false })
  desktopVisible: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ required: false })
  mobileVisible: boolean;
}

class DashboardLayoutDto implements DashboardLayout {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetConfigDto)
  @ApiProperty({ type: [DashboardWidgetConfigDto] })
  widgets: DashboardWidgetConfigDto[];
}

class UserPreferencesResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ type: DashboardLayoutDto })
  dashboardLayout: DashboardLayoutDto;

  @ApiProperty()
  updatedAt: string;
}

@ApiTags('preferences')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('preferences')
export class PreferencesController {
  constructor(
    private readonly getUserPreferencesUseCase: GetUserPreferencesUseCase,
    private readonly updateUserPreferencesUseCase: UpdateUserPreferencesUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user preferences' })
  @ApiResponse({ status: 200, type: UserPreferencesResponseDto })
  async get(@Request() req: any): Promise<UserPreferencesResponseDto> {
    const preferences = await this.getUserPreferencesUseCase.execute(req.user.id);
    return {
      userId: preferences.userId,
      dashboardLayout: preferences.dashboardLayout,
      updatedAt: preferences.updatedAt.toISOString(),
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Update dashboard layout' })
  @ApiResponse({ status: 200, type: UserPreferencesResponseDto })
  async update(
    @Request() req: any,
    @Body() dto: DashboardLayoutDto,
  ): Promise<UserPreferencesResponseDto> {
    const preferences = await this.updateUserPreferencesUseCase.execute({
      userId: req.user.id,
      dashboardLayout: dto,
    });
    return {
      userId: preferences.userId,
      dashboardLayout: preferences.dashboardLayout,
      updatedAt: preferences.updatedAt.toISOString(),
    };
  }
}
