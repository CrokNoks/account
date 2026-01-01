import { Module } from '@nestjs/common';
import { BudgetTemplatesService } from './budget-templates.service';
import { BudgetTemplatesController } from './budget-templates.controller';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { AiBudgetService } from './ai-budget.service';

@Module({
  providers: [BudgetTemplatesService, BudgetsService, AiBudgetService],
  controllers: [BudgetTemplatesController, BudgetsController],
  exports: [AiBudgetService, BudgetsService], // Export AI service for Periods
})
export class BudgetsModule { }
