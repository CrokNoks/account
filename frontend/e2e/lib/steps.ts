import { expect, type Page } from '@playwright/test';
import { gotoOk, login } from './fixtures';
import { E2E_PREFIX } from './test-data';

/** Nom unique préfixé `e2e-` : le nettoyage ne supprime que cela. */
export function uniqueName(kind: string) {
  return `${E2E_PREFIX}${kind}-${Date.now()}`;
}

/** Les visites guidées recouvrent l'écran : on les marque comme terminées (docs/tour.md). */
export async function skipTours(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'ui-storage',
      JSON.stringify({ state: { completedTours: { dashboard: true, account: true, transactions: true } }, version: 0 }),
    );
  });
}

/** Connexion puis création d'un compte bancaire par l'écran Comptes (devient le compte actif). Retourne son nom. */
export async function loginWithFreshAccount(page: Page): Promise<string> {
  const accountName = uniqueName('compte');
  await skipTours(page);
  await login(page);
  // Un compte neuf est poussé vers /accounts par l'accueil : on attend cette redirection avant de naviguer.
  await page.waitForURL(/\/accounts$/, { timeout: 20_000 }).catch(() => {});
  await gotoOk(page, '/accounts');
  await page.getByRole('button', { name: 'Ajouter un compte' }).click();
  await page.getByRole('dialog').getByLabel('Nom', { exact: true }).fill(accountName);
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText(accountName).first()).toBeVisible();
  return accountName;
}
