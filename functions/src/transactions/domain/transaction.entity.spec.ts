import { Transaction } from './transaction.entity';

describe('Transaction Entity', () => {
  it('should create a valid transaction', () => {
    const transaction = Transaction.create({
      accountId: 'acc-123',
      categoryId: 'cat-456',
      date: new Date('2026-03-07'),
      description: 'Groceries',
      amount: BigInt(-4550), // -45.50€
      reconciled: false,
      metadata: {},
    });

    expect(transaction.id).toBeDefined();
    expect(transaction.accountId).toBe('acc-123');
    expect(transaction.description).toBe('Groceries');
    expect(transaction.amount).toBe(BigInt(-4550));
    expect(transaction.reconciled).toBe(false);
    expect(transaction.createdAt).toBeInstanceOf(Date);
  });

  it('should throw error if description is empty', () => {
    expect(() => {
      Transaction.create({
        accountId: 'acc-123',
        categoryId: 'cat-456',
        date: new Date(),
        description: '',
        amount: BigInt(-1000),
        metadata: {},
      });
    }).toThrow('Description is required');
  });

  it('should throw error if accountId is missing', () => {
    expect(() => {
      Transaction.create({
        accountId: '',
        categoryId: 'cat-456',
        date: new Date(),
        description: 'Test',
        amount: BigInt(-1000),
        metadata: {},
      });
    }).toThrow('Account ID is required');
  });

  it('should default reconciled to false', () => {
    const transaction = Transaction.create({
      accountId: 'acc-123',
      categoryId: 'cat-456',
      date: new Date(),
      description: 'Test',
      amount: BigInt(-1000),
      metadata: {},
    });

    expect(transaction.reconciled).toBe(false);
  });
});
