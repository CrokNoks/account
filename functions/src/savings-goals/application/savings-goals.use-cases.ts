import { Injectable, Inject } from '@nestjs/common';
import type { SavingsGoalRepository } from '../domain/savings-goal.repository.interface';
import { SavingsGoal } from '../domain/savings-goal.entity';

@Injectable()
export class GetSavingsGoalsUseCase {
  constructor(
    @Inject('SavingsGoalRepository')
    private readonly repository: SavingsGoalRepository,
  ) {}

  async execute(accountId: string): Promise<SavingsGoal[]> {
    return this.repository.findAllByAccount(accountId);
  }
}

export interface CreateSavingsGoalCommand {
  accountId: string;
  name: string;
  targetAmount: string;
  deadline?: string;
  color?: string;
}

@Injectable()
export class CreateSavingsGoalUseCase {
  constructor(
    @Inject('SavingsGoalRepository')
    private readonly repository: SavingsGoalRepository,
  ) {}

  async execute(command: CreateSavingsGoalCommand): Promise<SavingsGoal> {
    const goal = SavingsGoal.create({
      accountId: command.accountId,
      name: command.name,
      targetAmount: BigInt(command.targetAmount),
      deadline: command.deadline ? new Date(command.deadline) : null,
      color: command.color || '#3b82f6',
    });

    await this.repository.save(goal);
    return goal;
  }
}

export interface UpdateSavingsGoalCommand {
  id: string;
  name?: string;
  targetAmount?: string;
  currentAmount?: string;
  deadline?: string | null;
  color?: string;
}

@Injectable()
export class UpdateSavingsGoalUseCase {
  constructor(
    @Inject('SavingsGoalRepository')
    private readonly repository: SavingsGoalRepository,
  ) {}

  async execute(command: UpdateSavingsGoalCommand): Promise<SavingsGoal> {
    const existing = await this.repository.findById(command.id);
    if (!existing) throw new Error('Savings goal not found');

    const updated = new SavingsGoal({
      ...existing,
      name: command.name ?? existing.name,
      targetAmount: command.targetAmount
        ? BigInt(command.targetAmount)
        : existing.targetAmount,
      currentAmount: command.currentAmount
        ? BigInt(command.currentAmount)
        : existing.currentAmount,
      deadline:
        command.deadline === null
          ? null
          : command.deadline
            ? new Date(command.deadline)
            : existing.deadline,
      color: command.color ?? existing.color,
      updatedAt: new Date(),
    });

    await this.repository.save(updated);
    return updated;
  }
}
