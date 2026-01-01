import { Controller, Get, Query, Headers } from '@nestjs/common';
import { BudgetsService } from './budgets.service';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) { }

  @Get()
  getBudgetsForPeriod(
    @Query('period_id') periodId: string,
    @Headers('authorization') token: string,
  ) {
    if (!periodId) {
      throw new Error('Period ID is required');
    }
    return this.budgetsService.getBudgetsForPeriod(periodId, token);
  }
}
