import { afterEach, expect, it, vi } from 'vitest';
import globalSetup from './global-setup';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('cible de prod : refusée avant toute requête réseau', async () => {
  vi.stubEnv('E2E_BASE_URL', 'https://account-c6a3f.web.app');
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);

  await expect(globalSetup()).rejects.toThrow(/refus/i);
  expect(fetchSpy).not.toHaveBeenCalled();
});
