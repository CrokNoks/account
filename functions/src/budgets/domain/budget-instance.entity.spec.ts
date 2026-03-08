import { BudgetInstance } from './budget-instance.entity';

describe('BudgetInstance Entity', () => {
  it('should create a valid budget instance', () => {
    const instance = BudgetInstance.create({
      periodId: 'per-123',
      categoryId: 'cat-456',
      amountAllocated: BigInt(-50000), // -500.00€
    });

    expect(instance.id).toBeDefined();
    expect(instance.periodId).toBe('per-123');
    expect(instance.categoryId).toBe('cat-456');
    expect(instance.amountAllocated).toBe(BigInt(-50000));
  });

  it('should throw if periodId is missing', () => {
    expect(() => {
      BudgetInstance.create({
        periodId: '',
        categoryId: 'cat-456',
        amountAllocated: BigInt(-1000),
      });
    }).toThrow('Period ID is required');
  });

  it('should throw if categoryId is missing', () => {
    expect(() => {
      BudgetInstance.create({
        periodId: 'per-123',
        categoryId: '',
        amountAllocated: BigInt(-1000),
      });
    }).toThrow('Category ID is required');
  });
});
