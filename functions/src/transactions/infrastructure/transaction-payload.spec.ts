import { Transaction } from '../domain/transaction.entity';
import { toTransactionPayload } from './transaction-payload';

describe('toTransactionPayload', () => {
  it('does not send any savings_goal_id key to the SQL function', () => {
    const payload = toTransactionPayload(
      Transaction.create({
        accountId: 'acc-1',
        categoryId: null,
        date: new Date('2026-03-01'),
        description: 'Coffee',
        amount: BigInt(-350),
        reconciled: false,
        pending: false,
      }),
    );

    expect(payload).not.toHaveProperty('savings_goal_id');
    expect(payload.amount).toBe('-350');
  });
});
