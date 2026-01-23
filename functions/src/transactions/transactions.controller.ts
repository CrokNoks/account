import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { TransactionsService } from './transactions.service'
import { CreateTransactionDto } from './dtos/create-transaction.dto'
import { UpdateTransactionDto } from './dtos/update-transaction.dto'
import { TransactionResponseDto, TransactionListResponseDto, BalanceResponseDto } from './dtos/transaction-response.dto'
import { FirebaseAuthGuard } from '../core/guards/firebase-auth.guard'

/**
 * Transactions REST API Controller
 * Handles HTTP endpoints for transaction management
 * @class TransactionsController
 */
@Controller('transactions')
@UseGuards(FirebaseAuthGuard)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  /**
   * Create a new transaction
   * POST /transactions
   *
   * @param createDto - Transaction creation data
   * @returns Created transaction
   * @example
   * POST /transactions
   * {
   *   "account_id": "uuid",
   *   "type": "expense",
   *   "amount": 25.99,
   *   "date": "2024-01-23",
   *   "description": "Grocery shopping"
   * }
   */
  @Post()
  async create(@Body() createDto: CreateTransactionDto): Promise<TransactionResponseDto> {
    return this.transactionsService.create(createDto)
  }

  /**
   * Get transaction by ID
   * GET /transactions/:id
   *
   * @param id - Transaction ID
   * @param accountId - Account ID (query parameter for authorization)
   * @returns Transaction data
   */
  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Query('account_id') accountId: string
  ): Promise<TransactionResponseDto> {
    if (!accountId) {
      throw new BadRequestException('account_id query parameter is required')
    }
    return this.transactionsService.findById(id, accountId)
  }

  /**
   * List transactions for an account
   * GET /transactions
   *
   * Query parameters:
   * - account_id: UUID (required)
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   * - type: 'expense' | 'income' | 'transfer' | 'adjustment' (optional)
   * - status: reconciliation status (optional)
   * - startDate: ISO date (optional)
   * - endDate: ISO date (optional)
   *
   * @returns Paginated transaction list
   */
  @Get()
  async list(
    @Query('account_id') accountId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<TransactionListResponseDto> {
    if (!accountId) {
      throw new BadRequestException('account_id query parameter is required')
    }

    const { data, total, page: currentPage, limit: currentLimit } = await this.transactionsService.findByAccount(
      accountId,
      {
        page,
        limit,
        type,
        status,
        startDate,
        endDate,
      }
    )

    return {
      data,
      total,
      page: currentPage,
      limit: currentLimit,
      pages: Math.ceil(total / currentLimit),
    }
  }

  /**
   * Update a transaction
   * PUT /transactions/:id
   *
   * @param id - Transaction ID
   * @param accountId - Account ID (query parameter)
   * @param updateDto - Update data (partial)
   * @returns Updated transaction
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Query('account_id') accountId: string,
    @Body() updateDto: UpdateTransactionDto
  ): Promise<TransactionResponseDto> {
    if (!accountId) {
      throw new BadRequestException('account_id query parameter is required')
    }
    return this.transactionsService.update(id, accountId, updateDto)
  }

  /**
   * Delete a transaction
   * DELETE /transactions/:id
   *
   * @param id - Transaction ID
   * @param accountId - Account ID (query parameter)
   */
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Query('account_id') accountId: string
  ): Promise<{ success: boolean }> {
    if (!accountId) {
      throw new BadRequestException('account_id query parameter is required')
    }
    await this.transactionsService.delete(id, accountId)
    return { success: true }
  }

  /**
   * Get account balance at a specific date
   * GET /transactions/balance/:accountId
   *
   * Query parameters:
   * - date: ISO date (optional, defaults to today)
   *
   * @returns Balance breakdown
   */
  @Get('balance/:accountId')
  async getBalance(
    @Param('accountId') accountId: string,
    @Query('date') date?: string
  ): Promise<BalanceResponseDto> {
    return this.transactionsService.getBalance(accountId, date)
  }

  /**
   * Get count of unreconciled transactions
   * GET /transactions/unreconciled/:accountId
   *
   * @returns Unreconciled transaction count
   */
  @Get('unreconciled/:accountId')
  async getUnreconciledCount(
    @Param('accountId') accountId: string
  ): Promise<{ count: number }> {
    const count = await this.transactionsService.getUnreconciledCount(accountId)
    return { count }
  }
}
