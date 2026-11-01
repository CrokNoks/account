import { Transaction } from '../domain/transaction.entity';

/**
 * Forme JSON d'une transaction attendue par la fonction SQL `insert_transactions`
 * (supabase/migrations/20261030100000_atomic_create_transfer.sql). Les tags
 * (table de liaison `transaction_tags`) voyagent dans `tag_ids`.
 */
export function toTransactionPayload(transaction: Transaction) {
  return {
    id: transaction.id,
    account_id: transaction.accountId,
    category_id: transaction.categoryId,
    period_id: transaction.periodId,
    date: transaction.date.toISOString().split('T')[0],
    description: transaction.description,
    amount: transaction.amount.toString(),
    reconciled: transaction.reconciled,
    pending: transaction.pending,
    payment_method: transaction.paymentMethod,
    notes: transaction.notes,
    metadata: transaction.metadata || {},
    created_at: transaction.createdAt.toISOString(),
    updated_at: transaction.updatedAt.toISOString(),
    tag_ids: transaction.tagIds || [],
  };
}
