import { parseDateOnly } from '../../shared/domain/date-only';
import { Injectable, Inject } from '@nestjs/common';
import type { SavingsGoalRepository } from '../domain/savings-goal.repository.interface';
import { SavingsGoal } from '../domain/savings-goal.entity';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import { parseCents } from '../../shared/domain/cents';

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
      targetAmount: parseCents(command.targetAmount),
      deadline: command.deadline ? parseDateOnly(command.deadline) : null,
      color: command.color || '#3b82f6',
    });

    await this.repository.save(goal);
    return goal;
  }
}

export interface UpdateSavingsGoalCommand {
  accountId: string;
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
    const existing = ensureBelongsToAccount(
      await this.repository.findById(command.id),
      command.accountId,
      'Savings goal',
    );

    const updated = new SavingsGoal({
      ...existing,
      name: command.name ?? existing.name,
      targetAmount: command.targetAmount
        ? parseCents(command.targetAmount)
        : existing.targetAmount,
      currentAmount: command.currentAmount
        ? parseCents(command.currentAmount)
        : existing.currentAmount,
      deadline:
        command.deadline === null
          ? null
          : command.deadline
            ? parseDateOnly(command.deadline)
            : existing.deadline,
      color: command.color ?? existing.color,
      updatedAt: new Date(),
    });

    await this.repository.save(updated);
    return updated;
  }
}

@Injectable()
export class DeleteSavingsGoalUseCase {
  constructor(
    @Inject('SavingsGoalRepository')
    private readonly repository: SavingsGoalRepository,
  ) {}

  async execute(accountId: string, id: string): Promise<void> {
    ensureBelongsToAccount(
      await this.repository.findById(id),
      accountId,
      'Savings goal',
    );
    await this.repository.delete(id);
  }
}
