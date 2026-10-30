import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/api-client';
import { useCreateAccount } from '@/features/accounts/api/use-create-account';
import { useCreateTag } from '@/features/tags/api/use-create-tag';
import { useCashflowForecast } from '@/features/reporting/api/use-cashflow-forecast';
import { useReportingStats } from '@/features/reporting/api/use-reporting-stats';

vi.mock('@/shared/api/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const api = vi.mocked(apiClient, true);

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })
    }
  >
    {children}
  </QueryClientProvider>
);

// Requêtes que le back refuse aujourd'hui (voir functions/test/front-contract.e2e-spec.ts).
// Ces tests figent ce que le front envoie, pour que le correctif soit visible des deux côtés.
describe('front requests known to mismatch the API', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) {
      vi.mocked(fn).mockReset().mockResolvedValue({ data: {} });
    }
  });

  it('useCreateAccount sends type and currency, which the API rejects (400)', async () => {
    const { result } = renderHook(() => useCreateAccount(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        name: 'Courant',
        type: 'checking',
        currency: 'EUR',
        initialBalance: '150000',
      }),
    );

    expect(api.post).toHaveBeenCalledWith('/accounts', {
      name: 'Courant',
      type: 'checking',
      currency: 'EUR',
      initialBalance: '150000',
    });
  });

  it('useCreateTag can send a tag without color, which the API rejects (400)', async () => {
    const { result } = renderHook(() => useCreateTag(), { wrapper });

    await act(() => result.current.mutateAsync({ accountId: 'acc-1', name: 'Vacances' }));

    expect(api.post).toHaveBeenCalledWith('/acc-1/tags', { name: 'Vacances' });
  });

  it('useCashflowForecast uses GET, while the API exposes POST (404)', async () => {
    const { result } = renderHook(() => useCashflowForecast('acc-1', 30), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/acc-1/reporting/cashflow', {
      params: { days: 30 },
    });
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('reporting queries', () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({ data: { startBalance: '0' } });
  });

  it('useReportingStats waits for both account and period', () => {
    renderHook(() => useReportingStats('acc-1', null), { wrapper });

    expect(api.get).not.toHaveBeenCalled();
  });

  it('useReportingStats GETs the stats of the period', async () => {
    const { result } = renderHook(() => useReportingStats('acc-1', 'per-1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/acc-1/periods/per-1/reporting/stats');
  });
});
