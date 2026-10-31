import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import messages from '../../../messages/fr.json';
import { createMutationCache, getApiErrorMessage, type ApiErrorTranslator } from './mutation-error';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const apiError = (message: unknown) => ({ response: { data: { message } } });

const apiErrors = messages.ApiErrors as Record<string, unknown>;
const lookup = (key: string) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], apiErrors);
const t: ApiErrorTranslator = Object.assign(
  (key: string, values?: Record<string, string | number>) =>
    String(lookup(key)).replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k])),
  { has: (key: string) => typeof lookup(key) === 'string' },
);

describe('getApiErrorMessage', () => {
  it('translates a known API message', () => {
    expect(getApiErrorMessage(apiError('Description is required'), 'fallback', t)).toBe(
      'La description est obligatoire',
    );
    expect(getApiErrorMessage(apiError('Tag not found'), 'fallback', t)).toBe('Étiquette introuvable');
  });
  it('translates class-validator messages by rule, with the field name', () => {
    expect(getApiErrorMessage(apiError('color must be a hexadecimal color'), 'fallback', t)).toBe(
      'Le champ « couleur » doit être une couleur hexadécimale (ex. #FF5733)',
    );
    expect(getApiErrorMessage(apiError('amount must not be less than 1'), 'fallback', t)).toBe(
      'Le champ « montant » doit être au moins 1',
    );
    expect(
      getApiErrorMessage(apiError('amount must be an integer amount in cents within ±(2^53 - 1)'), 'fallback', t),
    ).toContain('en centimes');
  });
  it('translates overlap, blank, max length and paging messages', () => {
    expect(getApiErrorMessage(apiError('Period overlaps an existing period'), 'fallback', t)).toBe(
      'Cette période chevauche une période existante',
    );
    expect(getApiErrorMessage(apiError(['name must not be blank']), 'fallback', t)).toBe(
      'Le champ « nom » ne peut pas être vide',
    );
    expect(getApiErrorMessage(apiError('pattern must be shorter than or equal to 255 characters'), 'fallback', t)).toBe(
      'Le champ « motif » ne peut pas dépasser 255 caractères',
    );
    expect(
      getApiErrorMessage(apiError('each value in descriptions must be shorter than or equal to 50 characters'), 'fallback', t),
    ).toBe('Le champ « descriptions » ne peut pas dépasser 50 caractères');
    expect(getApiErrorMessage(apiError('paymentMethod must be one of the following values: a, b'), 'fallback', t)).toBe(
      'Le champ « moyen de paiement » a une valeur non autorisée',
    );
    expect(getApiErrorMessage(apiError(['Description is required']), 'fallback', t)).toBe(
      'La description est obligatoire',
    );
    expect(getApiErrorMessage(apiError('page must not be less than 1'), 'fallback', t)).toBe(
      'Le champ « page » doit être au moins 1',
    );
  });
  it('translates an email-bearing message', () => {
    expect(
      getApiErrorMessage(
        apiError('User with email a@b.fr not found. They must have logged in at least once.'),
        'fallback',
        t,
      ),
    ).toContain('a@b.fr');
  });
  it('translates each validation message and joins them (string[])', () => {
    expect(getApiErrorMessage(apiError(['name must be a string', 'Amount is required']), 'fallback', t)).toBe(
      'Le champ « nom » doit être un texte · Le montant est obligatoire',
    );
  });
  it('never shows raw English: an unknown message gives the fallback', () => {
    expect(getApiErrorMessage(apiError('Something odd happened'), 'fallback', t)).toBe('fallback');
    expect(getApiErrorMessage(apiError(['Something odd', 'Description is required']), 'fallback', t)).toBe(
      'La description est obligatoire',
    );
  });
  it('falls back when there is no usable message', () => {
    expect(getApiErrorMessage(new Error('Network Error'), 'fallback', t)).toBe('fallback');
    expect(getApiErrorMessage(apiError([]), 'fallback', t)).toBe('fallback');
    expect(getApiErrorMessage(apiError(''), 'fallback', t)).toBe('fallback');
    expect(getApiErrorMessage(undefined, 'fallback', t)).toBe('fallback');
  });
});

describe('global mutation error toast', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={
        new QueryClient({
          mutationCache: createMutationCache('generic error', t).cache,
          defaultOptions: { mutations: { retry: false } },
        })
      }
    >
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => vi.clearAllMocks());

  it('shows the translated API message for a mutation without onError', async () => {
    const { result } = renderHook(
      () => useMutation({ mutationFn: async () => Promise.reject(apiError('Transaction not found')) }),
      { wrapper },
    );
    act(() => result.current.mutate());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Transaction introuvable'));
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
