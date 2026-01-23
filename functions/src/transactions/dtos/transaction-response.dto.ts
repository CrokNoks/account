/**
 * Response DTO for transaction
 * @class TransactionResponseDto
 */
export class TransactionResponseDto {
  id!: string
  account_id!: string
  type!: 'expense' | 'income' | 'transfer' | 'adjustment'
  amount!: number
  currency!: string
  date!: string
  description!: string
  notes?: string
  category_id?: string
  period_id?: string
  payment_method_id?: string
  reconciliation_status!: string
  reconciled_at?: string
  linked_transaction_id?: string
  metadata?: Record<string, any>
  created_at!: string
  updated_at!: string
}

/**
 * Response DTO for transaction list with pagination
 * @class TransactionListResponseDto
 */
export class TransactionListResponseDto {
  data!: TransactionResponseDto[]
  total!: number
  page!: number
  limit!: number
  pages!: number
}

/**
 * Response DTO for account balance
 * @class BalanceResponseDto
 */
export class BalanceResponseDto {
  total_balance!: number
  reconciled_balance!: number
  unreconciled_balance!: number
  currency!: string
  as_of_date!: string
}

/**
 * Response DTO for reconciliation history
 * @class ReconciliationHistoryDto
 */
export class ReconciliationHistoryDto {
  id!: string
  transaction_id!: string
  old_status!: string
  new_status!: string
  changed_by!: string
  changed_at!: string
  reason?: string
}
