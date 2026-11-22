import { describe, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
import { gotoOk } from './fixtures';

type Step = Error | { status: number };

/** Faux `page` : chaque appel à goto consomme une étape (erreur levée ou réponse HTTP). */
function fakePage(steps: Step[]) {
  const goto = vi.fn(async () => {
    const step = steps.shift()!;
    if (step instanceof Error) throw step;
    return { status: () => step.status };
  });
  const waitForTimeout = vi.fn(async () => {});
  const waitForLoadState = vi.fn(async () => {});
  return { page: { goto, waitForTimeout, waitForLoadState } as unknown as Page, goto };
}

describe('gotoOk (recette instable : 5xx, navigation coupée)', () => {
  it('réessaie après une navigation interrompue (net::ERR_ABORTED)', async () => {
    const { page, goto } = fakePage([new Error('page.goto: net::ERR_ABORTED at https://x/'), { status: 200 }]);
    await gotoOk(page, '/login');
    expect(goto).toHaveBeenCalledTimes(2);
  });

  it('réessaie après un 500 puis un 503', async () => {
    const { page, goto } = fakePage([{ status: 500 }, { status: 503 }, { status: 200 }]);
    await gotoOk(page, '/');
    expect(goto).toHaveBeenCalledTimes(3);
  });

  it('ne masque pas une autre erreur de navigation', async () => {
    const { page } = fakePage([new Error('page.goto: net::ERR_NAME_NOT_RESOLVED')]);
    await expect(gotoOk(page, '/')).rejects.toThrow(/ERR_NAME_NOT_RESOLVED/);
  });
});
