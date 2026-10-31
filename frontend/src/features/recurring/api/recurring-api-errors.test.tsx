import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import { apiClient } from '@/shared/api/api-client';
import { useCreateRecurringTransaction } from './use-create-recurring-transaction';
import { useUpdateRecurringTransaction } from './use-update-recurring-transaction';
import { useDeleteRecurringTransaction } from './use-delete-recurring-transaction';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/shared/api/api-client', () => ({
  apiClient: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="fr" messages={fr}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        {children}
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

const cases = [
  {
    name: 'create',
    method: 'post' as const,
    fallback: fr.Recurring.create_error,
    run: () => renderHook(() => useCreateRecurringTransaction(), { wrapper }),
    vars: { accountId: 'a1', description: 'Netflix', amount: '-1500', categoryId: 'c1', dayOfMonth: 5 },
  },
  {
    name: 'update',
    method: 'patch' as const,
    fallback: fr.Recurring.update_error,
    run: () => renderHook(() => useUpdateRecurringTransaction(), { wrapper }),
    vars: { accountId: 'a1', id: 'r1', data: { description: 'x' } },
  },
  {
    name: 'delete',
    method: 'delete' as const,
    fallback: fr.Recurring.delete_error,
    run: () => renderHook(() => useDeleteRecurringTransaction(), { wrapper }),
    vars: { accountId: 'a1', id: 'r1' },
  },
];

describe.each(cases)('recurring $name error toast', ({ method, fallback, run, vars }) => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the API message once', async () => {
    vi.mocked(apiClient[method]).mockRejectedValue({ response: { data: { message: 'Account not found' } } });
    const { result } = run();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    act(() => (result.current as any).mutate(vars));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Compte introuvable'));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('falls back to the translated message when the API gave none', async () => {
    vi.mocked(apiClient[method]).mockRejectedValue(new Error('Network Error'));
    const { result } = run();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    act(() => (result.current as any).mutate(vars));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(fallback));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe.each(cases)('recurring $name success', ({ method, run, vars }) => {
  it('does not toast by itself (the screen shows the success message)', async () => {
    vi.clearAllMocks();
    vi.mocked(apiClient[method]).mockResolvedValue({ data: {} });
    const { result } = run();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    act(() => (result.current as any).mutate(vars));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await waitFor(() => expect((result.current as any).isSuccess).toBe(true));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
