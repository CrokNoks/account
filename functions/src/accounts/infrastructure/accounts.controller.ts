import { Controller, Post, Get, Body, UseGuards, Request, Patch, Param } from '@nestjs/common';
import { CreateAccountUseCase, CreateAccountInput } from '../application/create-account.use-case';
import { GetAccountsUseCase } from '../application/get-accounts.use-case';
import { AccountRepository } from '../domain/account.repository.interface';
import { IsString, IsOptional, IsNumberString } from 'class-validator';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ description: 'The name of the account', example: 'Main Account' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'The initial balance in cents', example: '1000', required: false })
  @IsOptional()
  @IsNumberString()
  initialBalance?: string; // DTO uses string for bigint input
}

export class UpdateAccountDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumberString() initialBalance?: string;
}

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(SupabaseAuthGuard)
export class AccountsController {
  constructor(
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly getAccountsUseCase: GetAccountsUseCase,
    private readonly accountRepository: AccountRepository,
  ) {}

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
    const ownerId = req.user.id;
    const accounts = await this.getAccountsUseCase.execute(ownerId);

    return accounts.map((account) => ({
      ...account,
      initialBalance: account.initialBalance.toString(),
    }));
  }
}
