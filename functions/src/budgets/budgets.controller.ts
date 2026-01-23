import { Controller, Get, Query, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { FirebaseAuthGuard } from '../core/guards/firebase-auth.guard';

/**
 * Controller for budget-related operations
 * Manages budget retrieval and creation
 */
@Controller('budgets')
@UseGuards(FirebaseAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  /**
   * Get budgets for a specific period
   * @param periodId - The period ID (required)
   * @param token - Authorization token from headers
   * @returns Array of budgets for the period
   * @throws BadRequestException if period_id is missing
   */
  @Get()
  async getBudgetsForPeriod(
    @Query('period_id') periodId: string,
    @Request() req: any,
  ) {
    if (!periodId) {
      throw new BadRequestException('Period ID is required');
    }

    const token = req.headers.authorization;
    return this.budgetsService.getBudgetsForPeriod(periodId, token);
  }
}
