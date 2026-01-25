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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dtos/create-transaction.dto';
import { UpdateTransactionDto } from './dtos/update-transaction.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { FirebaseAuthGuard } from '../core/guards/firebase-auth.guard';

// Enhanced interfaces following TypeScript guidelines
interface ServiceStatusResponse {
  status: string;
  timestamp: string;
}

/**
 * Transactions REST API Controller
 * Handles HTTP endpoints for transaction management with proper validation and error handling
 * Follows AGENTS.md guidelines for performance and code quality
 */
@Controller('transactions')
@UseGuards(FirebaseAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Creates a new transaction
   * @param createDto - Transaction creation data
   * @returns Created transaction response
   * @throws BadRequestException if validation fails
   */
  @Post()
  async create(@Body() createDto: CreateTransactionDto): Promise<any> {
    return this.transactionsService.create(createDto);
  }

  /**
   * Gets paginated transactions
   * @param accountId - Account ID filter
   * @param page - Page number (optional)
   * @param limit - Items per page (optional)
   * @returns Paginated transactions list
   */
  @Get()
  async findAll(
    @Query('accountId') accountId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<any> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 25;
    
    return this.transactionsService.getTransactionsByAccount(
      accountId,
      pageNum,
      limitNum
    );
  }

  /**
   * Gets a specific transaction by ID
   * @param id - Transaction ID
   * @returns Transaction details
   * @throws NotFoundException if transaction not found
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<any> {
    // For now, return update without changes
    // In a real implementation, this would fetch the specific transaction
    return this.transactionsService.update(id, {});
  }

  /**
   * Updates an existing transaction
   * @param id - Transaction ID
   * @param updateDto - Update data
   * @returns Updated transaction response
   * @throws NotFoundException if transaction not found
   * @throws BadRequestException if validation fails
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateTransactionDto
  ): Promise<any> {
    return this.transactionsService.update(id, updateDto);
  }

  /**
   * Deletes a transaction
   * @param id - Transaction ID
   * @returns Delete operation result
   * @throws NotFoundException if transaction not found
   */
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.transactionsService.delete(id);
  }

  /**
   * Gets account balance information
   * @param accountId - Account ID
   * @returns Balance breakdown
   */
  @Get('balance/:accountId')
  async getBalance(@Param('accountId') accountId: string): Promise<any> {
    return this.transactionsService.getBalance(accountId);
  }

  /**
   * Creates a transfer between two accounts
   * Creates dual expense records (debit and credit)
   * @param createDto - Transfer creation data
   * @returns Transfer result with both expense records
   */
  @Post('transfers')
  async createTransfer(@Body() createDto: CreateTransferDto): Promise<any> {
    return this.transactionsService.createTransfer(createDto);
  }

  /**
   * Imports expenses from CSV file
   * @param file - CSV file to import
   * @param accountId - Account ID for expenses
   * @returns Import result with statistics
   */
  @Post('import-csv')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: any,
    @Query('account_id') accountId: string,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!accountId) {
      throw new BadRequestException('Account ID is required');
    }

    return this.transactionsService.importCsv(file.buffer, accountId);
  }

  /**
   * Health check endpoint for transactions service
   * @returns Service status response
   */
  @Get('health')
  getHealth(): ServiceStatusResponse {
    return {
      status: 'Transactions service is healthy',
      timestamp: new Date().toISOString()
    };
  }
}