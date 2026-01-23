/**
 * Transaction type enumeration
 * Defines semantic categories for transactions
 */
export const TRANSACTION_TYPES = {
  EXPENSE: 'expense' as const,
  INCOME: 'income' as const,
  TRANSFER: 'transfer' as const,
  ADJUSTMENT: 'adjustment' as const,
} as const

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES]

/**
 * Reconciliation status enumeration
 * Defines workflow states for transaction reconciliation
 */
export const RECONCILIATION_STATUSES = {
  PENDING: 'pending' as const,
  CONFIRMED: 'confirmed' as const,
  RECONCILED: 'reconciled' as const,
  DISPUTED: 'disputed' as const,
  REVERSED: 'reversed' as const,
} as const

export type ReconciliationStatus = typeof RECONCILIATION_STATUSES[keyof typeof RECONCILIATION_STATUSES]

/**
 * Core transaction interface
 * Represents a single transaction record
 */
export interface Transaction {
  id: string
  account_id: string
  type: TransactionType
  amount: number
  currency: string
  date: string
  description: string
  notes?: string
  category_id?: string
  period_id?: string
  payment_method_id?: string
  reconciliation_status: ReconciliationStatus
  reconciled_at?: string
  linked_transaction_id?: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Payment method interface
 * Represents a payment method associated with an account
 */
export interface PaymentMethod {
  id: string
  account_id: string
  type: string // credit_card, bank_account, cash, check, digital_wallet, etc.
  name: string
  metadata: Record<string, any> // last4, iban, issuer, etc.
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Balance breakdown at a specific date
 */
export interface AccountBalance {
  total_balance: number
  reconciled_balance: number
  unreconciled_balance: number
  currency: string
  as_of_date: string
}

/**
 * Reconciliation history entry
 * Tracks state transitions and reasons
 */
export interface ReconciliationHistory {
  id: string
  transaction_id: string
  old_status: ReconciliationStatus
  new_status: ReconciliationStatus
  changed_by: string
  changed_at: string
  reason?: string
}

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  pages: number
}

/**
 * Transaction creation request
 */
export interface CreateTransactionRequest {
  account_id: string
  type: TransactionType
  amount: number
  currency?: string
  date: Date
  description: string
  notes?: string
  category_id?: string
  period_id?: string
  payment_method_id?: string
  linked_transaction_id?: string
  reconciliation_status?: ReconciliationStatus
  metadata?: Record<string, any>
}

/**
 * Transaction update request
 */
export interface UpdateTransactionRequest {
  description?: string
  notes?: string
  category_id?: string
  payment_method_id?: string
  reconciliation_status?: ReconciliationStatus
  reconciliation_reason?: string
  metadata?: Record<string, any>
}

/**
 * Transaction filter options
 */
export interface TransactionFilterOptions {
  page?: number
  limit?: number
  type?: TransactionType
  status?: ReconciliationStatus
  startDate?: string
  endDate?: string
}
