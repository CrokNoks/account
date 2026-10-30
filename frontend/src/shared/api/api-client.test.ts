import type { InternalAxiosRequestConfig } from 'axios';
import { AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({ auth: { getSession } })),
}));

// L'intercepteur enregistré sur apiClient, appelé comme le ferait axios.
async function intercept(): Promise<InternalAxiosRequestConfig> {
  vi.resetModules();
  const { apiClient } = await import('./api-client');
  const handlers = (
    apiClient.interceptors.request as unknown as {
      handlers: { fulfilled: (c: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig> }[];
    }
  ).handlers;
  return handlers[0].fulfilled({ headers: new AxiosHeaders() });
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    getSession.mockReset();
  });

  it('uses NEXT_PUBLIC_API_URL as base URL, with a local default', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    expect((await import('./api-client')).apiClient.defaults.baseURL).toBe(
      'https://api.example.com',
    );

    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    expect((await import('./api-client')).apiClient.defaults.baseURL).toBe(
      'http://localhost:5001/api',
    );
  });

  it('attaches the Supabase access token as a Bearer token', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'jwt-123' } },
    });

    const config = await intercept();

    expect(config.headers.Authorization).toBe('Bearer jwt-123');
  });

  it('sends the request without Authorization when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    const config = await intercept();

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('does not query Supabase when it is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');

    const config = await intercept();

    expect(getSession).not.toHaveBeenCalled();
    expect(config.headers.Authorization).toBeUndefined();
  });
});
