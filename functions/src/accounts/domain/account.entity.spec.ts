import { Account } from './account.entity';

describe('Account Entity', () => {
  it('should create an account with default initial balance of 0', () => {
    const account = new Account({
      id: 'acc-1',
      name: 'Main Account',
      ownerId: 'user-1',
    });

    expect(account.id).toBe('acc-1');
    expect(account.name).toBe('Main Account');
    expect(account.ownerId).toBe('user-1');
    expect(account.initialBalance).toBe(0n);
  });

  it('should create an account with a specific initial balance', () => {
    const account = new Account({
      id: 'acc-2',
      name: 'Savings',
      ownerId: 'user-1',
      initialBalance: 1050n, // 10.50 euros
    });

    expect(account.initialBalance).toBe(1050n);
  });
});
