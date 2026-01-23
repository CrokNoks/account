import { Controller, Get, Post, Delete, Body, Param, Query, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { PeriodsService, CreatePeriodDto } from './periods.service';
import { FirebaseAuthGuard } from '../core/guards/firebase-auth.guard';

/**
 * Controller for period-related operations
 * Manages period CRUD and business logic like budget generation
 */
@Controller('periods')
@UseGuards(FirebaseAuthGuard)
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  /**
   * Get all periods for an account
   * Optionally filter by active status
   * @param accountId - Account ID (required)
   * @param isActive - Filter by active status (optional)
   * @param token - Authorization token
   * @returns Array of periods
   */
  @Get()
  async findAll(
    @Query('account_id') accountId: string,
    @Query('is_active') isActive: string,
    @Request() req: any,
  ) {
    if (!accountId) {
      throw new BadRequestException('Account ID is required');
    }
    const token = req.headers.authorization;
    return this.periodsService.findAll(accountId, isActive, token);
  }

  /**
   * Get the active period for an account
   * @param accountId - Account ID (required)
   * @param token - Authorization token
   * @returns Active period or null
   */
  @Get('active')
  async findActive(
    @Query('account_id') accountId: string,
    @Request() req: any,
  ) {
    if (!accountId) {
      throw new BadRequestException('Account ID is required');
    }
    const token = req.headers.authorization;
    return this.periodsService.findActive(accountId, token);
  }

  /**
   * Get a period by ID
   * @param id - Period ID
   * @param token - Authorization token
   * @returns Period data
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const token = req.headers.authorization;
    return this.periodsService.findOne(id, token);
  }

  /**
   * Get a financial report for a period
   * @param id - Period ID
   * @param token - Authorization token
   * @returns Period financial report
   */
  @Get(':id/report')
  async getReport(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const token = req.headers.authorization;
    return this.periodsService.getReport(id, token);
  }

  /**
   * Preview the next period with AI-generated suggestions
   * @param accountId - Account ID (required in body)
   * @param token - Authorization token
   * @returns Preview of next period including dates and budgets
   */
  @Post('preview')
  async previewNextPeriod(
    @Body('account_id') accountId: string,
    @Request() req: any,
  ) {
    if (!accountId) {
      throw new BadRequestException('Account ID is required in body');
    }
    const token = req.headers.authorization;
    return this.periodsService.previewNextPeriod(accountId, token);
  }

  /**
   * Create a new period with budgets
   * @param createPeriodDto - Period creation data
   * @param token - Authorization token
   * @returns Created period
   */
  @Post()
  async create(
    @Body() createPeriodDto: CreatePeriodDto,
    @Request() req: any,
  ) {
    const token = req.headers.authorization;
    return this.periodsService.createPeriodWithBudgets(createPeriodDto, token);
  }

  /**
   * Close an active period
   * @param id - Period ID
   * @param token - Authorization token
   * @returns Updated period with is_active set to false
   */
  @Post(':id/close')
  async close(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const token = req.headers.authorization;
    return this.periodsService.closePeriod(id, token);
  }

  /**
   * Delete a period
   * @param id - Period ID
   * @param token - Authorization token
   * @returns Delete result
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const token = req.headers.authorization;
    return this.periodsService.remove(id, token);
  }
}
