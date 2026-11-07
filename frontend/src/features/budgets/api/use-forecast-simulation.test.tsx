import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/api-client';
import { useForecastSimulation } from './use-forecast-simulation';

const sim = (forecastBalance: string) => ({ forecastBalance });

type B = Array<{ categoryId: string; amountAllocated: string }>;

/** L'écran n'active la simulation qu'à la première saisie : le premier rendu est désactivé. */
const BASE: B = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    ({ b }: { b: B }) => useForecastSimulation({ accountId: 'a', periodId: 'p', budgets: b, enabled: b !== BASE }),
    { wrapper, initialProps: { b: BASE } },
  );
}

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe('useForecastSimulation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends one request 300 ms after the last keystroke, with the complete list', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: sim('100') });
    const { result, rerender } = setup();
    rerender({ b: [{ categoryId: 'c', amountAllocated: '1' }] });

    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    rerender({ b: [{ categoryId: 'c', amountAllocated: '12' }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(post).not.toHaveBeenCalled();
    expect(result.current.isStale).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe('/a/periods/p/reporting/forecast-simulation');
    expect(post.mock.calls[0][1]).toEqual({ budgets: [{ categoryId: 'c', amountAllocated: '12' }] });
    await flush();
    expect(result.current.data?.forecastBalance).toBe('100');
    expect(result.current.isStale).toBe(false);
  });

  it('aborts the previous request and only shows the answer of the last value, even if it arrives first', async () => {
    const resolvers: Array<(v: unknown) => void> = [];
    const signals: AbortSignal[] = [];
    vi.spyOn(apiClient, 'post').mockImplementation(((_url: string, _body: unknown, cfg?: { signal?: AbortSignal }) => {
      signals.push(cfg!.signal!);
      return new Promise((resolve) => resolvers.push(resolve));
    }) as never);

    const { result, rerender } = setup();
    rerender({ b: [{ categoryId: 'c', amountAllocated: '1' }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(301); });
    await flush();
    expect(signals).toHaveLength(1);

    rerender({ b: [{ categoryId: 'c', amountAllocated: '2' }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(301); });
    await flush();
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(result.current.isStale).toBe(true);

    // la réponse de la 2e valeur arrive d'abord, celle de la 1re ensuite (ignorée)
    resolvers[1]({ data: sim('222') });
    await flush();
    resolvers[0]({ data: sim('111') });
    await flush();

    expect(result.current.data?.forecastBalance).toBe('222');
    expect(result.current.isStale).toBe(false);
  });

  it('keeps the previous figure but flags it stale while the new answer is awaited', async () => {
    let resolveSecond: (v: unknown) => void = () => {};
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce({ data: sim('100') })
      .mockImplementationOnce((() => new Promise((r) => (resolveSecond = r))) as never);
    const { result, rerender } = setup();
    rerender({ b: [{ categoryId: 'c', amountAllocated: '1' }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(301); });
    await flush();
    expect(result.current.data?.forecastBalance).toBe('100');

    rerender({ b: [{ categoryId: 'c', amountAllocated: '2' }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(301); });
    await flush();
    expect(post).toHaveBeenCalledTimes(2);
    expect(result.current.data?.forecastBalance).toBe('100');
    expect(result.current.isStale).toBe(true);

    resolveSecond({ data: sim('200') });
    await flush();
    expect(result.current.data?.forecastBalance).toBe('200');
    expect(result.current.isStale).toBe(false);
  });

  it('asks again for a list already seen (actuals may have changed) and flags the cached figure stale meanwhile', async () => {
    let resolveThird: (v: unknown) => void = () => {};
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce({ data: sim('100') })
      .mockResolvedValueOnce({ data: sim('200') })
      .mockImplementationOnce((() => new Promise((r) => (resolveThird = r))) as never);
    const A: B = [{ categoryId: 'c', amountAllocated: '1' }];
    const { result, rerender } = setup();
    rerender({ b: A });
    await act(async () => { await vi.advanceTimersByTimeAsync(301); });
    await flush();
    rerender({ b: [{ categoryId: 'c', amountAllocated: '2' }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(301); });
    await flush();

    // retour à la liste A : sa réponse en cache (100) n'est pas présentée comme à jour
    rerender({ b: [...A] });
    await act(async () => { await vi.advanceTimersByTimeAsync(301); });
    await flush();
    expect(post).toHaveBeenCalledTimes(3);
    expect(result.current.isStale).toBe(true);

    resolveThird({ data: sim('150') });
    await flush();
    expect(result.current.data?.forecastBalance).toBe('150');
    expect(result.current.isStale).toBe(false);
  });

  it('does not call the API when disabled', async () => {
    const post = vi.spyOn(apiClient, 'post');
    const client = new QueryClient();
    renderHook(() => useForecastSimulation({ accountId: 'a', periodId: 'p', budgets: [], enabled: false }), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(post).not.toHaveBeenCalled();
  });
});
