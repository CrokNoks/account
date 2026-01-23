import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { CreateTransactionDto } from './dtos/create-transaction.dto'
import { UpdateTransactionDto } from './dtos/update-transaction.dto'
import { TransactionResponseDto, BalanceResponseDto } from './dtos/transaction-response.dto'

/**
 * Service for managing transactions
 * Handles creation, updates, retrieval, and reconciliation of transactions
 * @class TransactionsService
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name)

  constructor(private supabase: SupabaseService) {}

  /**
   * Create a new transaction
   * @param createDto - Transaction creation data
   * @returns Created transaction
   * @throws BadRequestException if validation fails
   */
  async create(createDto: CreateTransactionDto): Promise<TransactionResponseDto> {
    try {
      this.logger.debug(`Creating transaction for account: ${createDto.account_id}`)

      if (!createDto.amount || createDto.amount <= 0) {
        throw new BadRequestException('Amount must be greater than 0')
      }

      if (!createDto.description?.trim()) {
        throw new BadRequestException('Description is required')
      }

      const { data, error } = await this.supabase.getClient()
        .from('transactions')
        .insert({
          account_id: createDto.account_id,
          type: createDto.type,
          amount: createDto.amount,
          currency: createDto.currency || 'EUR',
          date: createDto.date,
          description: createDto.description,
          notes: createDto.notes,
          category_id: createDto.category_id,
          period_id: createDto.period_id,
          payment_method_id: createDto.payment_method_id,
          linked_transaction_id: createDto.linked_transaction_id,
          reconciliation_status: createDto.reconciliation_status || 'pending',
          metadata: createDto.metadata || {},
        })
        .select()
        .single()

      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.logger.error(`Failed to create transaction: ${errorMessage}`)
        throw new BadRequestException(errorMessage)
      }

      return this.formatTransaction(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to create transaction: ${errorMessage}`)
      throw error
    }
  }

  /**
   * Get transaction by ID
   * @param transactionId - Transaction ID
   * @param accountId - Account ID for authorization
   * @returns Transaction data
   * @throws NotFoundException if transaction not found
   */
  async findById(transactionId: string, accountId: string): Promise<TransactionResponseDto> {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('account_id', accountId)
        .single()

      if (error || !data) {
        throw new NotFoundException('Transaction not found')
      }

      return this.formatTransaction(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to find transaction: ${errorMessage}`)
      throw error
    }
  }

  /**
   * List transactions for an account with pagination
   * @param accountId - Account ID
   * @param options - Query options (page, limit, type, status, startDate, endDate)
   * @returns Paginated transaction list
   */
  async findByAccount(
    accountId: string,
    options: {
      page?: number
      limit?: number
      type?: string
      status?: string
      startDate?: string
      endDate?: string
    } = {}
  ): Promise<{ data: TransactionResponseDto[]; total: number; page: number; limit: number }> {
    try {
      const page = Math.max(1, options.page || 1)
      const limit = Math.min(100, Math.max(1, options.limit || 20))
      const offset = (page - 1) * limit

      this.logger.debug(`Fetching transactions for account: ${accountId}`)

      // Build query
      let query = this.supabase.getClient()
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('account_id', accountId)

      // Apply filters
      if (options.type) {
        query = query.eq('type', options.type)
      }

      if (options.status) {
        query = query.eq('reconciliation_status', options.status)
      }

      if (options.startDate) {
        query = query.gte('date', options.startDate)
      }

      if (options.endDate) {
        query = query.lte('date', options.endDate)
      }

      // Get total before pagination
      const { count } = await query

      // Apply pagination and ordering
      const { data, error } = await query
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new BadRequestException(errorMessage)
      }

      return {
        data: (data || []).map(t => this.formatTransaction(t)),
        total: count || 0,
        page,
        limit,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to list transactions: ${errorMessage}`)
      throw error
    }
  }

  /**
   * Update a transaction
   * @param transactionId - Transaction ID
   * @param accountId - Account ID for authorization
   * @param updateDto - Update data
   * @returns Updated transaction
   */
  async update(
    transactionId: string,
    accountId: string,
    updateDto: UpdateTransactionDto
  ): Promise<TransactionResponseDto> {
    try {
      this.logger.debug(`Updating transaction: ${transactionId}`)

      // Prepare metadata with reconciliation reason if provided
      const metadata = updateDto.metadata || {}
      if (updateDto.reconciliation_reason) {
        metadata.reconciliation_reason = updateDto.reconciliation_reason
      }

      const { data, error } = await this.supabase.getClient()
        .from('transactions')
        .update({
          description: updateDto.description,
          notes: updateDto.notes,
          category_id: updateDto.category_id,
          payment_method_id: updateDto.payment_method_id,
          reconciliation_status: updateDto.reconciliation_status,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId)
        .eq('account_id', accountId)
        .select()
        .single()

      if (error || !data) {
        throw new NotFoundException('Transaction not found')
      }

      return this.formatTransaction(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to update transaction: ${errorMessage}`)
      throw error
    }
  }

  /**
   * Delete a transaction
   * @param transactionId - Transaction ID
   * @param accountId - Account ID for authorization
   */
  async delete(transactionId: string, accountId: string): Promise<void> {
    try {
      this.logger.debug(`Deleting transaction: ${transactionId}`)

      const { error } = await this.supabase.getClient()
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('account_id', accountId)

      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new BadRequestException(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to delete transaction: ${errorMessage}`)
      throw error
    }
  }

  /**
   * Get account balance at a specific date
   * @param accountId - Account ID
   * @param date - Date for balance calculation
   * @returns Account balance breakdown
   */
  async getBalance(accountId: string, date?: string): Promise<BalanceResponseDto> {
    try {
      this.logger.debug(`Calculating balance for account: ${accountId}`)

      const targetDate = date || new Date().toISOString().split('T')[0]

      const { data, error } = await this.supabase.getClient()
        .rpc('get_account_balance', {
          p_account_id: accountId,
          p_date: targetDate,
        })

      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new BadRequestException(errorMessage)
      }

      return {
        total_balance: data[0]?.total_balance || 0,
        reconciled_balance: data[0]?.reconciled_balance || 0,
        unreconciled_balance: data[0]?.unreconciled_balance || 0,
        currency: 'EUR',
        as_of_date: targetDate,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to calculate balance: ${errorMessage}`)
      throw error
    }
  }

  /**
   * Get unreconciled transaction count
   * @param accountId - Account ID
   * @returns Count of unreconciled transactions
   */
  async getUnreconciledCount(accountId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase.getClient()
        .rpc('get_unreconciled_count', {
          p_account_id: accountId,
        })

      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new BadRequestException(errorMessage)
      }

      return data || 0
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to get unreconciled count: ${errorMessage}`)
      throw error
    }
  }

  /**
   * Format raw transaction data for response
   * @param transaction - Raw transaction object
   * @returns Formatted transaction response
   * @private
   */
  private formatTransaction(transaction: any): TransactionResponseDto {
    return {
      id: transaction.id,
      account_id: transaction.account_id,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency || 'EUR',
      date: transaction.date,
      description: transaction.description,
      notes: transaction.notes,
      category_id: transaction.category_id,
      period_id: transaction.period_id,
      payment_method_id: transaction.payment_method_id,
      reconciliation_status: transaction.reconciliation_status,
      reconciled_at: transaction.reconciled_at,
      linked_transaction_id: transaction.linked_transaction_id,
      metadata: transaction.metadata,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    }
  }
}