import { Controller, Post, Get, Body, UseGuards, Request, Patch, Param, Delete } from '@nestjs/common';
import { CreateAccountUseCase, CreateAccountInput } from '../application/create-account.use-case';
import { GetAccountsUseCase } from '../application/get-accounts.use-case';
import { ShareAccountUseCase } from '../application/share-account.use-case';
import { AccountRepository } from '../domain/account.repository.interface';
import { AccountShareRepository } from '../domain/account-share.repository.interface';
import { IsString, IsOptional, IsNumberString, IsEmail, IsIn } from 'class-validator';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ description: 'The name of the account', example: 'Main Account' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'The description of the account purpose', example: 'Main checking account for daily expenses', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'The initial balance in cents', example: '1000', required: false })
  @IsOptional()
  @IsNumberString()
  initialBalance?: string; // DTO uses string for bigint input
}

export class UpdateAccountDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumberString() initialBalance?: string;
}

export class ShareAccountDto {
  @IsEmail()
  @ApiProperty()
  email: string;

  @IsIn(['read', 'write'])
  @ApiProperty()
  permission: 'read' | 'write';
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
  async getShares(@Param('id') id: string) {
    return this.accountShareRepository.findAllByAccount(id);
  }

  @Post(':id/shares')
  @ApiOperation({ summary: 'Share an account with another user' })
  async share(
    @Param('id') id: string,
    @Body() dto: ShareAccountDto,
    @Request() req: any
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
  @ApiOperation({ summary: 'Remove a share from an account' })
  async removeShare(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: any
  ) {
    const account = await this.accountRepository.findById(id);
    if (!account) throw new Error('Account not found');
    if (account.ownerId !== req.user.id) throw new Error('Only owner can remove shares');

    await this.accountShareRepository.delete(id, userId);
    return { success: true };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiResponse({ status: 200 })
  async update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    const existing = await this.accountRepository.findById(id);
    if (!existing) throw new Error('Account not found');

    const updated = new (existing as any).constructor({
      ...existing,
      ...dto,
      initialBalance: dto.initialBalance ? BigInt(dto.initialBalance) : (existing as any).initialBalance,
      updatedAt: new Date(),
    });

    await this.accountRepository.save(updated);
    return {
      ...updated,
      initialBalance: updated.initialBalance.toString(),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  @ApiResponse({ status: 201, description: 'The account has been successfully created.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async create(@Body() dto: CreateAccountDto, @Request() req: any) {
    const ownerId = req.user.id;
    
    const account = await this.createAccountUseCase.execute({
      name: dto.name,
      ownerId: ownerId,
      description: dto.description,
      initialBalance: dto.initialBalance ? BigInt(dto.initialBalance) : undefined,
    });

    return {
      ...account,
      initialBalance: account.initialBalance.toString(), // JSON can't handle BigInt
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all accounts for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of accounts.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(@Request() req: any) {
    const userId = req.user.id;
    const accounts = await this.getAccountsUseCase.execute(userId);

    return accounts.map((account) => ({
      ...account,
      initialBalance: account.initialBalance.toString(),
    }));
  }
}
