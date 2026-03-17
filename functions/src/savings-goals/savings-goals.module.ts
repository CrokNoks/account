import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseSavingsGoalRepository } from './infrastructure/supabase-savings-goal.repository';
import { SavingsGoalsController } from './infrastructure/savings-goals.controller';
import { 
  GetSavingsGoalsUseCase, 
  CreateSavingsGoalUseCase, 
  UpdateSavingsGoalUseCase 
} from './application/savings-goals.use-cases';

@Module({
  imports: [SupabaseModule],
  controllers: [SavingsGoalsController],
  providers: [
    {
      provide: 'SavingsGoalRepository',
      useClass: SupabaseSavingsGoalRepository,
    },
    GetSavingsGoalsUseCase,
    CreateSavingsGoalUseCase,
    UpdateSavingsGoalUseCase,
  ],
  exports: ['SavingsGoalRepository'],
})
export class SavingsGoalsModule {}
