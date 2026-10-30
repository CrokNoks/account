import {
  CreateSavingsGoalUseCase,
  GetSavingsGoalsUseCase,
  UpdateSavingsGoalUseCase,
  DeleteSavingsGoalUseCase,
} from './savings-goals.use-cases';
import { SavingsGoal } from '../domain/savings-goal.entity';
import type { SavingsGoalRepository } from '../domain/savings-goal.repository.interface';

describe('Savings goals use cases', () => {
  let repository: jest.Mocked<SavingsGoalRepository>;

  const existing = () =>
    SavingsGoal.create({
      id: 'goal-1',
      accountId: 'acc-1',
      name: 'Vacances',
      targetAmount: BigInt(200000),
      currentAmount: BigInt(5000),
      deadline: new Date('2027-07-01'),
      color: '#10b981',
    });

  const lastSaved = () => repository.save.mock.calls.at(-1)![0];

  beforeEach(() => {
    repository = {
      findAllByAccount: jest.fn(),
      findById: jest.fn().mockResolvedValue(existing()),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
  });

  describe('GetSavingsGoalsUseCase', () => {
    it('returns the goals of the account', async () => {
      const goals = [existing()];
      repository.findAllByAccount.mockResolvedValue(goals);

      expect(
        await new GetSavingsGoalsUseCase(repository).execute('acc-1'),
      ).toBe(goals);
      expect(repository.findAllByAccount).toHaveBeenCalledWith('acc-1');
    });
  });

  describe('CreateSavingsGoalUseCase', () => {
    const useCase = () => new CreateSavingsGoalUseCase(repository);

    it('creates a goal from string amounts in cents and saves it', async () => {
      const goal = await useCase().execute({
        accountId: 'acc-1',
        name: 'Voiture',
        targetAmount: '1500000',
        deadline: '2027-01-01',
        color: '#f59e0b',
      });

      expect(goal.targetAmount).toBe(BigInt(1500000));
      expect(goal.currentAmount).toBe(BigInt(0));
      expect(goal.deadline).toEqual(new Date('2027-01-01'));
      expect(goal.color).toBe('#f59e0b');
      expect(repository.save).toHaveBeenCalledWith(goal);
    });

    it('defaults deadline to null and color to blue', async () => {
      const goal = await useCase().execute({
        accountId: 'acc-1',
        name: 'Voiture',
        targetAmount: '1500000',
      });

      expect(goal.deadline).toBeNull();
      expect(goal.color).toBe('#3b82f6');
    });

    it('rejects a zero target without saving', async () => {
      await expect(
        useCase().execute({
          accountId: 'acc-1',
          name: 'Voiture',
          targetAmount: '0',
        }),
      ).rejects.toThrow('Target amount must be positive');
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('UpdateSavingsGoalUseCase', () => {
    const useCase = () => new UpdateSavingsGoalUseCase(repository);

    it('rejects an unknown goal', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        useCase().execute({ accountId: 'acc-1', id: 'nope' }),
      ).rejects.toThrow('Savings goal not found');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a goal of another account without saving', async () => {
      await expect(
        useCase().execute({ accountId: 'acc-other', id: 'goal-1', name: 'x' }),
      ).rejects.toThrow('Savings goal not found');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('keeps every field when nothing is provided', async () => {
      await useCase().execute({ accountId: 'acc-1', id: 'goal-1' });

      expect(lastSaved()).toMatchObject({
        id: 'goal-1',
        accountId: 'acc-1',
        name: 'Vacances',
        targetAmount: BigInt(200000),
        currentAmount: BigInt(5000),
        deadline: new Date('2027-07-01'),
        color: '#10b981',
      });
    });

    it('updates the provided fields', async () => {
      const updated = await useCase().execute({
        accountId: 'acc-1',
        id: 'goal-1',
        name: 'Japon',
        targetAmount: '300000',
        deadline: '2028-04-01',
        color: '#ef4444',
      });

      expect(updated).toMatchObject({
        name: 'Japon',
        targetAmount: BigInt(300000),
        deadline: new Date('2028-04-01'),
        color: '#ef4444',
      });
      expect(repository.save).toHaveBeenCalledWith(updated);
    });

    it('removes the deadline when null is sent', async () => {
      await useCase().execute({
        accountId: 'acc-1',
        id: 'goal-1',
        deadline: null,
      });

      expect(lastSaved().deadline).toBeNull();
    });

    // Comportement actuel documenté (docs/savings.md) : « Contribuer » écrase
    // current_amount directement, alors que le trigger SQL le recalcule depuis
    // les transactions liées.
    it('overwrites currentAmount directly, without creating a transaction', async () => {
      await useCase().execute({
        accountId: 'acc-1',
        id: 'goal-1',
        currentAmount: '12000',
      });

      expect(lastSaved().currentAmount).toBe(BigInt(12000));
    });

    it('can reset currentAmount to 0', async () => {
      await useCase().execute({
        accountId: 'acc-1',
        id: 'goal-1',
        currentAmount: '0',
      });

      expect(lastSaved().currentAmount).toBe(BigInt(0));
    });

    it('rejects a target set to 0', async () => {
      await expect(
        useCase().execute({
          accountId: 'acc-1',
          id: 'goal-1',
          targetAmount: '0',
        }),
      ).rejects.toThrow('Target amount must be positive');
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('DeleteSavingsGoalUseCase', () => {
    const useCase = () => new DeleteSavingsGoalUseCase(repository);

    it('deletes a goal of the account', async () => {
      await useCase().execute('acc-1', 'goal-1');

      expect(repository.delete).toHaveBeenCalledWith('goal-1');
    });

    it.each([
      ['another account', existing()],
      ['nobody', null],
    ])('rejects without deleting when it belongs to %s', async (_, found) => {
      repository.findById.mockResolvedValue(found);

      await expect(useCase().execute('acc-other', 'goal-1')).rejects.toThrow(
        'Savings goal not found',
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
