import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { createMutationCache, getApiErrorMessage } from './mutation-error';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const apiError = (message: unknown) => ({ response: { data: { message } } });

describe('getApiErrorMessage', () => {
  it('uses the API message', () => {
    expect(getApiErrorMessage(apiError('Forbidden resource'), 'fallback')).toBe('Forbidden resource');
  });
  it('joins validation messages (string[])', () => {
    expect(getApiErrorMessage(apiError(['name must be a string', 'amount is required']), 'fallback')).toBe(
      'name must be a string · amount is required',
    );
  });
  it('falls back when there is no usable message', () => {
    expect(getApiErrorMessage(new Error('Network Error'), 'fallback')).toBe('fallback');
    expect(getApiErrorMessage(apiError([]), 'fallback')).toBe('fallback');
    expect(getApiErrorMessage(apiError(''), 'fallback')).toBe('fallback');
    expect(getApiErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});

describe('global mutation error toast', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={
        new QueryClient({
          mutationCache: createMutationCache('generic error').cache,
          defaultOptions: { mutations: { retry: false } },
        })
      }
    >
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => vi.clearAllMocks());

  it('shows the API message for a mutation without onError', async () => {
    const { result } = renderHook(
      () => useMutation({ mutationFn: async () => Promise.reject(apiError('Transaction not found')) }),
      { wrapper },
    );
    act(() => result.current.mutate());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Transaction not found'));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('shows the generic message when the API gave none', async () => {
    const { result } = renderHook(
      () => useMutation({ mutationFn: async () => Promise.reject(new Error('boom')) }),
      { wrapper },
    );
    act(() => result.current.mutate());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('generic error'));
  });

  it('shows a single toast when the mutation has its own onError', async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => Promise.reject(apiError('nope')),
          onError: () => toast.error('own message'),
        }),
      { wrapper },
    );
    act(() => result.current.mutate());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('own message'));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('shows a single toast when onError is passed per call and meta opts out', async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => Promise.reject(apiError('nope')),
          meta: { skipGlobalErrorToast: true },
        }),
      { wrapper },
    );
    act(() => result.current.mutate(undefined, { onError: () => toast.error('call message') }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('call message'));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
