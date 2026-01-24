import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTransactionDto } from './dtos/create-transaction.dto';
import { UpdateTransactionDto } from './dtos/update-transaction.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import Papa from 'papaparse';

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

  /**
   * Creates a transfer between two accounts
   * Creates dual expense records (debit from source, credit to destination)
   * @param createDto - Transfer creation data
   * @returns Transfer result with both expense records
   */
  async createTransfer(createDto: CreateTransferDto): Promise<any> {
    this.logger.debug('Creating transfer', {
      source_account_id: createDto.source_account_id,
      destination_account_id: createDto.destination_account_id,
      amount: createDto.amount,
      operation: 'createTransfer'
    });

    try {
      const baseFields = {
        description: createDto.description || 'Virement entre comptes',
        date: createDto.date || new Date().toISOString(),
        notes: createDto.notes || null,
        reconciled: false,
      };

      const absAmount = Math.abs(createDto.amount);

      const transferRows = [
        // Debit from source account
        {
          ...baseFields,
          account_id: createDto.source_account_id,
          category_id: createDto.source_category_id,
          amount: -absAmount,
        },
        // Credit to destination account
        {
          ...baseFields,
          account_id: createDto.destination_account_id,
          category_id: createDto.destination_category_id,
          amount: absAmount,
        },
      ];

      const { data, error } = await this.supabase.getClient()
        .from('expenses')
        .insert(transferRows)
        .select();

      if (error) {
        this.logger.error('Failed to create transfer', {
          error: error.message,
          createDto,
          operation: 'createTransfer'
        });
        throw new BadRequestException(`Transfer creation failed: ${error.message}`);
      }

      this.logger.log('Transfer created successfully', {
        source_account_id: createDto.source_account_id,
        destination_account_id: createDto.destination_account_id,
        amount: absAmount,
        created_records: data?.length || 0,
        operation: 'createTransfer'
      });

      // Return a logical transfer object for frontend
      return {
        id: data?.[0]?.id,
        source_account_id: createDto.source_account_id,
        destination_account_id: createDto.destination_account_id,
        amount: absAmount,
        description: baseFields.description,
        date: baseFields.date,
        created_records: data,
      };

    } catch (error) {
      this.logger.error('Unexpected error during transfer creation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        createDto,
        operation: 'createTransfer'
      });
      throw error;
    }
  }

  /**
   * Imports expenses from CSV file
   * @param csvBuffer - CSV file buffer
   * @param accountId - Account ID for expenses
   * @returns Import result with statistics
   */
  async importCsv(csvBuffer: Buffer, accountId: string): Promise<any> {
    this.logger.debug('Starting CSV import', {
      accountId,
      fileSize: csvBuffer.length,
      operation: 'importCsv'
    });

    const csvString = csvBuffer.toString('utf-8');
    const result = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
    });

    const rows = result.data as any[];
    const importResult = {
      total_rows: rows.length,
      imported_count: 0,
      skipped_count: 0,
      errors: [] as string[],
      imported_ids: [] as string[],
    };

    const expensesToInsert = rows
      .filter((row, index) => {
        // Validate required fields
        if (!row.date || !row.amount || !row.description) {
          importResult.errors.push(`Row ${index + 1}: Missing required fields (date, amount, description)`);
          importResult.skipped_count++;
          return false;
        }
        return true;
      })
      .map((row) => ({
        account_id: accountId,
        date: this.parseDate(row.date),
        amount: parseFloat(row.amount.toString().replace(',', '.')),
        description: row.description?.toString().trim(),
        notes: row.notes?.toString().trim() || null,
        reconciled: false,
        category_id: row.category_id || null,
        payment_method_id: row.payment_method_id || null,
      }));

    try {
      if (expensesToInsert.length > 0) {
        const { data, error } = await this.supabase.getClient()
          .from('expenses')
          .insert(expensesToInsert)
          .select('id');

        if (error) {
          throw new BadRequestException(`CSV import failed: ${error.message}`);
        }

        importResult.imported_count = data?.length || 0;
        importResult.imported_ids = data?.map((item: any) => item.id) || [];
      }
    } catch (error) {
      this.logger.error('CSV import database error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        accountId,
        operation: 'importCsv'
      });
      throw error;
    }

    this.logger.log('CSV import completed', {
      accountId,
      ...importResult,
      operation: 'importCsv'
    });

    return importResult;
  }

  /**
   * Parses date from various formats
   * @param dateString - Date string to parse
   * @returns ISO date string
   */
  private parseDate(dateString: string): string {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date format: ${dateString}`);
    }
    return date.toISOString();
  }
}