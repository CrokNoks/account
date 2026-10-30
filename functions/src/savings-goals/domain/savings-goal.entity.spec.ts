import { SavingsGoal } from './savings-goal.entity';

describe('SavingsGoal', () => {
  const base = {
    accountId: 'acc-1',
    name: 'Vacances',
    targetAmount: BigInt(200000),
    deadline: null,
    color: '#10b981',
  };

  it('creates a goal starting at 0 with an id and timestamps', () => {
    const goal = SavingsGoal.create(base);

    expect(goal.id).toBeDefined();
    expect(goal.currentAmount).toBe(BigInt(0));
    expect(goal.createdAt).toBeInstanceOf(Date);
  });

  it('keeps a provided current amount', () => {
    expect(
      SavingsGoal.create({ ...base, currentAmount: BigInt(5000) })
        .currentAmount,
    ).toBe(BigInt(5000));
  });

  it('defaults the color when empty', () => {
    expect(SavingsGoal.create({ ...base, color: '' }).color).toBe('#3b82f6');
  });

  it.each([BigInt(0), BigInt(-1)])(
    'rejects a non positive target (%s)',
    (targetAmount) => {
      expect(() => SavingsGoal.create({ ...base, targetAmount })).toThrow(
        'Target amount must be positive',
      );
    },
  );

  it.each(['', '   '])('rejects an empty name (%j)', (name) => {
    expect(() => SavingsGoal.create({ ...base, name })).toThrow(
      'Name is required',
    );
  });

  it('requires an account', () => {
    expect(() => SavingsGoal.create({ ...base, accountId: '' })).toThrow(
      'Account ID is required',
    );
  });

  // Comportement actuel : rien n'empêche de dépasser l'objectif ni d'être négatif.
  it('accepts a current amount above the target or negative', () => {
    expect(
      SavingsGoal.create({ ...base, currentAmount: BigInt(999999) })
        .currentAmount,
    ).toBe(BigInt(999999));
    expect(
      SavingsGoal.create({ ...base, currentAmount: BigInt(-100) })
        .currentAmount,
    ).toBe(BigInt(-100));
  });
});
