import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTransactionDto } from './dtos/create-transaction.dto';
import { UpdateTransactionDto } from './dtos/update-transaction.dto';

/**
 * Service for managing transactions with enhanced error handling
 * Follows AGENTS.md guidelines for performance and code quality
 */
@Injectable()
export class TransactionsService {
  private readonly logger: Logger;

  constructor(
    private readonly supabase: SupabaseService,
  ) {
    this.logger = new Logger(TransactionsService.name);
  }

  /**
   * Creates a transaction with validation and structured logging
   * @param createDto - Transaction creation data
   * @returns Created transaction response
   * @throws BadRequestException if validation fails
   */
  async create(createDto: CreateTransactionDto): Promise<any> {
    // Validate input data
    this.validateCreateTransaction(createDto);

    this.logger.debug('Creating transaction', {
      account_id: createDto.account_id,
      amount: createDto.amount,
      type: createDto.type,
      operation: 'create'
    });

    try {
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
        .single();

      if (error) {
        this.logger.error('Failed to create transaction', { 
          error: error.message,
          account_id: createDto.account_id,
          operation: 'create'
        });
        throw new BadRequestException(`Transaction creation failed: ${error.message}`);
      }

      this.logger.log('Transaction created successfully', {
        transaction_id: data.id,
        account_id: createDto.account_id,
        amount: createDto.amount,
        operation: 'create'
      });

      return data;
    } catch (error) {
      this.logger.error('Unexpected error during transaction creation', { 
        error: error instanceof Error ? error.message : String(error),
        account_id: createDto.account_id,
        operation: 'create'
      });
      throw new Error(`Transaction creation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets paginated transactions for a specific account
   * @param accountId - Account ID
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 25)
   * @returns Paginated transactions response
   */
  async getTransactionsByAccount(
    accountId: string,
    page: number = 1,
    limit: number = 25
  ): Promise<any> {
    this.logger.debug('Fetching transactions', { accountId, page, limit });

    try {
      const offset = (page - 1) * limit;
      
      const { data, error } = await this.supabase.getClient()
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false })
        .range(offset, limit);

      if (error) {
        this.logger.error('Failed to fetch transactions', { 
          error: error.message,
          accountId,
          operation: 'fetch'
        });
        throw new BadRequestException(`Failed to fetch transactions: ${error.message}`);
      }

      const total = await this.getTransactionCount(accountId);

      return {
        success: true,
        data: {
          transactions: data || [],
          pagination: {
            page,
            limit,
            hasMore: offset + limit < total,
            total
          }
        }
      };
    } catch (error) {
      this.logger.error('Unexpected error during transaction fetch', { 
        error: error instanceof Error ? error.message : String(error),
        accountId,
        operation: 'fetch'
      });
      throw new Error(`Failed to fetch transactions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Updates an existing transaction with validation
   * @param id - Transaction ID
   * @param updateDto - Update data
   * @returns Updated transaction response
   * @throws NotFoundException if transaction not found
   * @throws BadRequestException if validation fails
   */
  async update(id: string, updateDto: UpdateTransactionDto): Promise<any> {
    // Validate update data
    this.validateUpdateTransaction(updateDto);

    this.logger.debug('Updating transaction', { id, operation: 'update' });

    try {
      const { data, error } = await this.supabase.getClient()
        .from('transactions')
        .update(updateDto)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to update transaction', { 
          error: error.message,
          id,
          operation: 'update'
        });
        throw new BadRequestException(`Transaction update failed: ${error.message}`);
      }

      if (!data) {
        throw new NotFoundException('Transaction not found');
      }

      this.logger.log('Transaction updated successfully', {
        transaction_id: data.id,
        operation: 'update'
      });

      return {
        success: true,
        data
      };
    } catch (error) {
      this.logger.error('Unexpected error during transaction update', { 
        error: error instanceof Error ? error.message : String(error),
        id,
        operation: 'update'
      });
      throw new Error(`Failed to update transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets total transaction count for an account
   * @param accountId - Account ID
   * @returns Total transaction count
   */
  private async getTransactionCount(accountId: string): Promise<number> {
    try {
      const { count } = await this.supabase.getClient()
        .from('transactions')
        .select('id', { count: 'exact' })
        .eq('account_id', accountId)
        .single();

      return count || 0;
    } catch (error) {
      this.logger.error('Failed to get transaction count', { 
        error: error instanceof Error ? error.message : String(error),
        accountId
      });
      return 0;
    }
  }

  /**
   * Deletes a transaction
   * @param id - Transaction ID
   * @returns Delete operation result
   * @throws NotFoundException if transaction not found
   */
  async delete(id: string): Promise<{ success: boolean }> {
    this.logger.debug('Deleting transaction', { id, operation: 'delete' });

    try {
      const { error } = await this.supabase.getClient()
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error('Failed to delete transaction', { 
          error: error.message,
          id,
          operation: 'delete'
        });
        throw new BadRequestException(`Transaction deletion failed: ${error.message}`);
      }

      this.logger.log('Transaction deleted successfully', { 
        id,
        operation: 'delete'
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Unexpected error during transaction deletion', { 
        error: error instanceof Error ? error.message : String(error),
        id,
        operation: 'delete'
      });
      throw new Error(`Failed to delete transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets balance information for an account
   * @param accountId - Account ID
   * @returns Balance information with income/expense breakdown
   */
  async getBalance(accountId: string): Promise<any> {
    this.logger.debug('Getting balance', { accountId, operation: 'balance' });

    try {
      const { data } = await this.supabase.getClient()
        .from('transactions')
        .select('id, type, amount')
        .eq('account_id', accountId)
        .order('date', { ascending: false });

      const transactions = data || [];
      const income = transactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expenses = transactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const balance = income - expenses;

      return {
        success: true,
        data: {
          balance,
          income,
          expenses,
          transaction_count: transactions.length
        }
      };
    } catch (error) {
      this.logger.error('Failed to get balance', { 
        error: error instanceof Error ? error.message : String(error),
        accountId,
        operation: 'balance'
      });
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validates transaction creation data
   * @param createDto - Transaction creation data
   * @throws BadRequestException if validation fails
   */
  private validateCreateTransaction(createDto: CreateTransactionDto): void {
    if (!createDto.amount || createDto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (createDto.amount > 1000000) { // 10,000 EUR limit
      throw new BadRequestException('Amount cannot exceed 1000000 EUR');
    }

    if (!createDto.description?.trim()) {
      throw new BadRequestException('Description is required');
    }
  }

  /**
   * Validates transaction update data
   * @param updateDto - Transaction update data
   * @throws BadRequestException if validation fails
   */
  private validateUpdateTransaction(updateDto: UpdateTransactionDto): void {
    // Cast to any to access properties that might not be in interface
    const updateData = updateDto as any;
    
    if (updateData.amount && updateData.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (updateData.amount > 1000000) {
      throw new BadRequestException('Amount cannot exceed 1000000 EUR');
    }
  }
}