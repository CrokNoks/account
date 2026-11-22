import { test as base, expect, type Page } from '@playwright/test';
import { isForbiddenRequest } from './target-guard';
import { cleanupTestData } from './test-data';

/**
 * - Coupe toute requête du navigateur vers un service hors recette (filet de CA7).
 * - Nettoie après chaque test, qu'il passe ou échoue (CA6) ; le passage suivant et le teardown global rattrapent un kill.
 */
export const test = base.extend({
  page: async ({ page }, run) => {
    await page.route('**/*', (route) => (isForbiddenRequest(route.request().url()) ? route.abort() : route.fallback()));
    await run(page);
    await cleanupTestData();
  },
});

export { expect };

/**
 * Navigation qui retente sur une erreur serveur (500/503 à froid : rendu serveur Firebase à 256 Mo) ou une navigation coupée (net::ERR_ABORTED).
 * networkidle : attend l'hydratation, sinon un clic soumet le formulaire en natif ; borné à 10 s car une page qui poll ne l'atteint jamais.
 */
export async function gotoOk(page: Page, path: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await page.goto(path, { waitUntil: 'load' });
      if (response && response.status() < 500) {
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
        return;
      }
    } catch (error) {
      if (!/ERR_ABORTED/.test(String(error))) throw error;
    }
    await page.waitForTimeout(3000);
  }
  throw new Error(`La recette répond 500 sur ${path} après 5 essais : l'application déployée est en cause, pas le parcours.`);
}

export const HOME_URL = /\/(accounts)?$/;

/**
 * Connexion par le formulaire avec le compte de test.
 * Si le clic part avant l'hydratation, le navigateur soumet le formulaire en natif (URL `/login?`) : on recharge et on réessaie.
 */
export async function login(page: Page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await gotoOk(page, '/login');
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel('Mot de passe').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    // Accueil `/` ; un compte sans compte bancaire est ensuite poussé vers /accounts par l'accueil lui-même.
    try {
      await expect(page).toHaveURL(HOME_URL, { timeout: 20_000 });
      return;
    } catch (error) {
      if (attempt === 3 || !/\/login\??$/.test(page.url())) throw error;
    }
  }
}
