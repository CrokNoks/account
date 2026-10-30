import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/api-client';
import { useCreateTransaction } from './use-create-transaction';
import { useUpdateTransaction } from './use-update-transaction';
import { useDeleteTransaction } from './use-delete-transaction';
import {
  useBulkDeleteTransactions,
  useBulkUpdateTransactions,
} from './use-bulk-transactions';
import { useBulkCreateTransactions } from './use-bulk-create-transactions';
import { useCreateTransfer } from './use-create-transfer';
import { usePredictCategory } from './use-predict-category';
import { useTransactions } from './use-transactions';

vi.mock('@/shared/api/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const api = vi.mocked(apiClient, true);

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const invalidatedKeys = () =>
    invalidate.mock.calls.map(([filters]) => filters?.queryKey);
  return { wrapper, invalidatedKeys };
}

describe('transactions API hooks', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) {
      vi.mocked(fn).mockReset().mockResolvedValue({ data: {} });
    }
  });

  describe('useTransactions', () => {
    it('GETs the transactions of the account with the filters as query params', async () => {
      const page = { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } };
      api.get.mockResolvedValue({ data: page });
      const { wrapper } = setup();

      const { result } = renderHook(
        () => useTransactions('acc-1', { search: 'carrefour', page: 2 }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.get).toHaveBeenCalledWith('/acc-1/transactions', {
        params: { search: 'carrefour', page: 2 },
      });
      expect(result.current.data).toEqual(page);
    });

    it('does not call the API without account', () => {
      const { wrapper } = setup();

      renderHook(() => useTransactions(null), { wrapper });

      expect(api.get).not.toHaveBeenCalled();
    });
  });

  it('useCreateTransaction POSTs the body without accountId and refreshes transactions, reporting and anomalies', async () => {
    const { wrapper, invalidatedKeys } = setup();
    const { result } = renderHook(() => useCreateTransaction(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        accountId: 'acc-1',
        categoryId: null,
        date: '2026-03-01',
        description: 'CB CARREFOUR',
        amount: '-4250',
      }),
    );

    expect(api.post).toHaveBeenCalledWith('/acc-1/transactions', {
      categoryId: null,
      date: '2026-03-01',
      description: 'CB CARREFOUR',
      amount: '-4250',
    });
    expect(invalidatedKeys()).toEqual([
      ['transactions', 'acc-1'],
      ['reporting'],
      ['anomalies', 'acc-1'],
    ]);
  });

  it('useUpdateTransaction PATCHes the transaction', async () => {
    const { wrapper, invalidatedKeys } = setup();
    const { result } = renderHook(() => useUpdateTransaction(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        accountId: 'acc-1',
        id: 't1',
        data: { reconciled: true },
      }),
    );

    expect(api.patch).toHaveBeenCalledWith('/acc-1/transactions/t1', {
      reconciled: true,
    });
    expect(invalidatedKeys()).toContainEqual(['transactions', 'acc-1']);
  });

  it('useDeleteTransaction DELETEs the transaction', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useDeleteTransaction(), { wrapper });

    await act(() => result.current.mutateAsync({ accountId: 'acc-1', id: 't1' }));

    expect(api.delete).toHaveBeenCalledWith('/acc-1/transactions/t1');
  });

  // Côté back, PATCH :id et DELETE :id captent ces URLs (voir
  // functions/test/transactions.e2e-spec.ts) : ces deux actions n'aboutissent pas.
  describe('bulk actions', () => {
    it('useBulkUpdateTransactions PATCHes /transactions/bulk', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useBulkUpdateTransactions(), {
        wrapper,
      });

      await act(() =>
        result.current.mutateAsync({
          accountId: 'acc-1',
          command: { ids: ['t1', 't2'], data: { reconciled: true } },
        }),
      );

      expect(api.patch).toHaveBeenCalledWith('/acc-1/transactions/bulk', {
        ids: ['t1', 't2'],
        data: { reconciled: true },
      });
    });

    it('useBulkDeleteTransactions DELETEs /transactions/bulk with the ids in the body', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useBulkDeleteTransactions(), {
        wrapper,
      });

      await act(() =>
        result.current.mutateAsync({ accountId: 'acc-1', ids: ['t1', 't2'] }),
      );

      expect(api.delete).toHaveBeenCalledWith('/acc-1/transactions/bulk', {
        data: { ids: ['t1', 't2'] },
      });
    });

    it('useBulkCreateTransactions POSTs the lines', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useBulkCreateTransactions(), {
        wrapper,
      });
      const transactions = [
        { date: '2026-03-01', description: 'A', amount: '-100', categoryId: null },
      ];

      await act(() =>
        result.current.mutateAsync({ accountId: 'acc-1', transactions }),
      );

      expect(api.post).toHaveBeenCalledWith('/acc-1/transactions/bulk', {
        transactions,
      });
    });
  });

  it('useCreateTransfer POSTs on the source account and refreshes both accounts', async () => {
    const { wrapper, invalidatedKeys } = setup();
    const { result } = renderHook(() => useCreateTransfer(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        sourceAccountId: 'acc-1',
        destinationAccountId: 'acc-2',
        amount: '15000',
        date: '2026-03-01',
        description: 'Épargne',
      }),
    );

    expect(api.post).toHaveBeenCalledWith('/acc-1/transactions/transfer', {
      destinationAccountId: 'acc-2',
      amount: '15000',
      date: '2026-03-01',
      description: 'Épargne',
    });
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([
        ['transactions', 'acc-1'],
        ['transactions', 'acc-2'],
        ['accounts'],
      ]),
    );
  });

  it('usePredictCategory GETs the prediction for a description', async () => {
    api.get.mockResolvedValue({ data: { categoryId: 'cat-1' } });
    const { wrapper } = setup();
    const { result } = renderHook(() => usePredictCategory(), { wrapper });

    const prediction = await act(() =>
      result.current.mutateAsync({ accountId: 'acc-1', description: 'NETFLIX' }),
    );

    expect(api.get).toHaveBeenCalledWith('/acc-1/transactions/predict-category', {
      params: { description: 'NETFLIX' },
    });
    expect(prediction).toEqual({ categoryId: 'cat-1' });
  });
});
