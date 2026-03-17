import { SavingsGoal } from './savings-goal.entity';

export interface SavingsGoalRepository {
  findAllByAccount(accountId: string): Promise<SavingsGoal[]>;
  findById(id: string): Promise<SavingsGoal | null>;
  save(goal: SavingsGoal): Promise<void>;
  delete(id: string): Promise<void>;
}
