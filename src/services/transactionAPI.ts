import { supabaseClient } from '../supabaseClient'
import {
  Transaction,
  PaymentMethod,
  AccountBalance,
  ReconciliationHistory,
  PaginatedResponse,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionFilterOptions,
} from '../types/transaction.types'

/**
 * API service for transactions
 * Provides methods for CRUD operations on transactions
 */
export const transactionAPI = {
  /**
   * Create a new transaction
   */
  async create(request: CreateTransactionRequest): Promise<Transaction> {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`Failed to create transaction: ${response.statusText}`)
    }

    return response.json()
  },

  /**
   * Get transaction by ID
   */
  async getById(id: string, accountId: string): Promise<Transaction> {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/transactions/${id}?account_id=${accountId}`,
      {
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.statusText}`)
    }

    return response.json()
  },

  /**
   * List transactions for an account with pagination
   */
  async list(
    accountId: string,
    filters: TransactionFilterOptions = {}
  ): Promise<PaginatedResponse<Transaction>> {
    const params = new URLSearchParams({
      account_id: accountId,
      page: String(filters.page || 1),
      limit: String(filters.limit || 20),
    })

    if (filters.type) params.append('type', filters.type)
    if (filters.status) params.append('status', filters.status)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/transactions?${params}`,
      {
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.statusText}`)
    }

    return response.json()
  },

  /**
   * Update a transaction
   */
  async update(
    id: string,
    accountId: string,
    request: UpdateTransactionRequest
  ): Promise<Transaction> {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/transactions/${id}?account_id=${accountId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify(request),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to update transaction: ${response.statusText}`)
    }

    return response.json()
  },

  /**
   * Delete a transaction
   */
  async delete(id: string, accountId: string): Promise<void> {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/transactions/${id}?account_id=${accountId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to delete transaction: ${response.statusText}`)
    }
  },

  /**
   * Get account balance at a specific date
   */
  async getBalance(accountId: string, date?: string): Promise<AccountBalance> {
    const params = date ? `?date=${date}` : ''
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/transactions/balance/${accountId}${params}`,
      {
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.statusText}`)
    }

    return response.json()
  },

  /**
   * Get count of unreconciled transactions
   */
  async getUnreconciledCount(accountId: string): Promise<number> {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/transactions/unreconciled/${accountId}`,
      {
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch unreconciled count: ${response.statusText}`)
    }

    const data = await response.json()
    return data.count
  },

  /**
   * List reconciliation history for a transaction
   */
  async getReconciliationHistory(
    transactionId: string
  ): Promise<ReconciliationHistory[]> {
    const { data, error } = await supabaseClient
      .from('reconciliation_history')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('changed_at', { ascending: false })

    if (error) throw error
    return data || []
  },
}

/**
 * Get authentication token for API requests
 */
async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }

  return session.access_token
}

/**
 * Payment methods API service
 */
export const paymentMethodAPI = {
  /**
   * Create a payment method
   */
  async create(accountId: string, type: string, name: string, metadata?: Record<string, any>) {
    const { data, error } = await supabaseClient
      .from('payment_methods')
      .insert({
        account_id: accountId,
        type,
        name,
        metadata: metadata || {},
      })
      .select()
      .single()

    if (error) throw error
    return data as PaymentMethod
  },

  /**
   * List payment methods for an account
   */
  async list(accountId: string): Promise<PaymentMethod[]> {
    const { data, error } = await supabaseClient
      .from('payment_methods')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return (data || []) as PaymentMethod[]
  },

  /**
   * Update a payment method
   */
  async update(
    id: string,
    accountId: string,
    updates: Partial<PaymentMethod>
  ): Promise<PaymentMethod> {
    const { data, error } = await supabaseClient
      .from('payment_methods')
      .update(updates)
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single()

    if (error) throw error
    return data as PaymentMethod
  },

  /**
   * Delete a payment method (soft delete)
   */
  async delete(id: string, accountId: string): Promise<void> {
    const { error } = await supabaseClient
      .from('payment_methods')
      .update({ is_active: false })
      .eq('id', id)
      .eq('account_id', accountId)

    if (error) throw error
  },
}
