import { Module } from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { PeriodsController } from './periods.controller';
import { BudgetsModule } from '../budgets/budgets.module';
import { SharedModule } from '../shared/shared.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SharedModule, SupabaseModule, BudgetsModule], // Import Budgets to use AiBudgetService
  providers: [PeriodsService],
  controllers: [PeriodsController],
})
export class PeriodsModule { }
