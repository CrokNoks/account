import { Module } from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { PeriodsController } from './periods.controller';
import { BudgetsModule } from '../budgets/budgets.module';

@Module({
  imports: [BudgetsModule], // Import Budgets to use AiBudgetService
  providers: [PeriodsService],
  controllers: [PeriodsController],
})
export class PeriodsModule { }
