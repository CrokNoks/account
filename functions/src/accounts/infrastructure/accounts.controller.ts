import { ForbiddenError, NotFoundError } from '../../shared/domain/errors';
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Patch,
  Param,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { CreateAccountUseCase } from '../application/create-account.use-case';
import { GetAccountsUseCase } from '../application/get-accounts.use-case';
import { ShareAccountUseCase } from '../application/share-account.use-case';
import { AccountRepository } from '../domain/account.repository.interface';
import { AccountShareRepository } from '../domain/account-share.repository.interface';
import { IsString, IsEmail, IsIn, MaxLength, Matches } from 'class-validator';
import { IsOptionalNotNull } from '../../shared/infrastructure/is-optional-not-null.decorator';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { IgnoredLegacyField } from './ignored-legacy-field.decorator';
import { Account } from '../domain/account.entity';
import { parseCents } from '../../shared/domain/cents';
import { IsCents } from '../../shared/infrastructure/is-cents.decorator';

export class CreateAccountDto {
  @ApiProperty({
    description: 'The name of the account',
    example: 'Main Account',
  })
  @IsString()
  @MaxLength(255)
  @Matches(/\S/, { message: 'name must not be blank' })
  name: string;

  // Ancien champ encore envoyé par un front en cache.
  @IgnoredLegacyField() description?: unknown;

  @ApiProperty({
    description: 'The initial balance in cents',
    example: '1000',
    required: false,
  })
  @IsOptionalNotNull()
  @IsCents()
  initialBalance?: string; // DTO uses string for bigint input
}

export class UpdateAccountDto {
  @ApiProperty({ required: false })
  @IsOptionalNotNull()
  @IsString()
  @MaxLength(255)
  @Matches(/\S/, { message: 'name must not be blank' })
  name?: string;
  @ApiProperty({ required: false })
  @IsOptionalNotNull()
  @IsCents()
  initialBalance?: string;

  // Ancien champ encore envoyé par un front en cache.
  @IgnoredLegacyField() description?: unknown;
}

export class ShareAccountDto {
  @IsEmail()
  @ApiProperty()
  email: string;

  @IsIn(['read', 'write'])
  @ApiProperty()
  permission: 'read' | 'write';
}

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
  };
}

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(SupabaseAuthGuard)
export class AccountsController {
  constructor(
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly getAccountsUseCase: GetAccountsUseCase,
    private readonly shareAccountUseCase: ShareAccountUseCase,
    private readonly accountRepository: AccountRepository,
    private readonly accountShareRepository: AccountShareRepository,
  ) {}

  @Get(':id/shares')
  @ApiOperation({ summary: 'Get all shares for an account' })
  async getShares(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(id, req.user.id, 'Only owner can list shares');
    return this.accountShareRepository.findAllByAccount(id);
  }

  @Post(':id/shares')
  @ApiOperation({ summary: 'Share an account with another user' })
  async share(
    @Param('id') id: string,
    @Body() dto: ShareAccountDto,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.shareAccountUseCase.execute({
      accountId: id,
      email: dto.email,
      permission: dto.permission,
      initiatorId: req.user.id,
    });
    return { success: true };
  }

  @Delete(':id/shares/:userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a share from an account' })
  @ApiResponse({ status: 204 })
  async removeShare(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.assertOwner(id, req.user.id, 'Only owner can remove shares');

    await this.accountShareRepository.delete(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiResponse({ status: 200 })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const existing = await this.assertOwner(
      id,
      req.user.id,
      'Only owner can update the account',
    );

    const updated = new Account({
      id: existing.id,
      ownerId: existing.ownerId,
      name: dto.name ?? existing.name,
      initialBalance: dto.initialBalance
        ? parseCents(dto.initialBalance)
        : existing.initialBalance,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.accountRepository.save(updated);
    return {
      id: updated.id,
      name: updated.name,
      ownerId: updated.ownerId,
      initialBalance: updated.initialBalance.toString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  private async assertOwner(
    accountId: string,
    userId: string,
    message: string,
  ): Promise<Account> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) throw new NotFoundError('Account not found');
    if (account.ownerId !== userId) throw new ForbiddenError(message);
    return account;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  @ApiResponse({
    status: 201,
    description: 'The account has been successfully created.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async create(
    @Body() dto: CreateAccountDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const ownerId = req.user.id;

    const account = await this.createAccountUseCase.execute({
      name: dto.name,
      ownerId: ownerId,
      initialBalance: dto.initialBalance
        ? parseCents(dto.initialBalance)
        : undefined,
    });

    return {
      id: account.id,
      name: account.name,
      ownerId: account.ownerId,
      initialBalance: account.initialBalance.toString(),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all accounts for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of accounts.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll() {
    const accounts = await this.getAccountsUseCase.execute();

    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      ownerId: account.ownerId,
      initialBalance: account.initialBalance.toString(),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    }));
  }
}
