import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { TransactionFilterOptions } from '../types/transaction.types'
import { transactionAPI } from '../services/transactionAPI'

/**
 * Hook for managing transactions list with TanStack Query
 * Automatically deduplicates and caches requests
 */
export function useTransactions(accountId: string, filters: TransactionFilterOptions = {}) {
  const filterKey = JSON.stringify(filters)

  const { data, error, isLoading } = useQuery({
    queryKey: ['transactions', accountId, filterKey],
    queryFn: () => transactionAPI.list(accountId, filters),
    enabled: !!accountId,
    staleTime: 60000, // 1 minute
  })

  const queryClient = useQueryClient()

  return {
    transactions: data?.data || [],
    total: data?.total || 0,
    page: data?.page || 1,
    pages: data?.pages || 0,
    isLoading,
    error,
    mutate: queryClient.invalidateQueries.bind(queryClient),
  }
}

/**
 * Hook for managing account balance
 */
export function useAccountBalance(accountId: string, date?: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['balance', accountId, date],
    queryFn: () => transactionAPI.getBalance(accountId, date),
    enabled: !!accountId,
    staleTime: 300000, // 5 minutes
  })

  const queryClient = useQueryClient()

  return {
    balance: data,
    isLoading,
    error,
    mutate: queryClient.invalidateQueries.bind(queryClient),
  }
}

/**
 * Hook for managing unreconciled count
 */
export function useUnreconciledCount(accountId: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['unreconciled', accountId],
    queryFn: () => transactionAPI.getUnreconciledCount(accountId),
    enabled: !!accountId,
    refetchInterval: 60000, // 1 minute
  })

  const queryClient = useQueryClient()

  return {
    count: data || 0,
    isLoading,
    error,
    mutate: queryClient.invalidateQueries.bind(queryClient),
  }
}

/**
 * Hook for transaction creation with optimistic updates
 */
export function useCreateTransaction() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: transactionAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      queryClient.invalidateQueries({ queryKey: ['unreconciled'] })
    },
  })

  const create = useCallback(
    async (request: any) => {
      setIsLoading(true)
      setError(null)

      try {
        return await createMutation.mutateAsync(request)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create transaction'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [createMutation]
  )

  return { create, isLoading, error }
}

/**
 * Hook for transaction updates with optimistic updates
 */
export function useUpdateTransaction() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: ({ id, accountId, request }: { id: string; accountId: string; request: any }) => 
      transactionAPI.update(id, accountId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  })

  const update = useCallback(
    async (id: string, accountId: string, request: any) => {
      setIsLoading(true)
      setError(null)

      try {
        return await updateMutation.mutateAsync({ id, accountId, request })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update transaction'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [updateMutation]
  )

  return { update, isLoading, error }
}

/**
 * Hook for transaction deletion
 */
export function useDeleteTransaction() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) => 
      transactionAPI.delete(id, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      queryClient.invalidateQueries({ queryKey: ['unreconciled'] })
    },
  })

  const delete_ = useCallback(
    async (id: string, accountId: string) => {
      setIsLoading(true)
      setError(null)

      try {
        await deleteMutation.mutateAsync({ id, accountId })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete transaction'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [deleteMutation]
  )

  return { delete: delete_, isLoading, error }
}