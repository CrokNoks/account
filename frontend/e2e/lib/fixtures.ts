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
 * Navigation qui retente sur une erreur serveur : la recette répond parfois 500 à froid (rendu serveur Firebase).
 * networkidle : attend l'hydratation, sinon un clic soumet le formulaire en natif.
 */
export async function gotoOk(page: Page, path: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await page.goto(path, { waitUntil: 'networkidle' });
    if (response && response.status() < 500) return;
    await page.waitForTimeout(3000);
  }
  throw new Error(`La recette répond 500 sur ${path} après 5 essais : l'application déployée est en cause, pas le parcours.`);
}

export const HOME_URL = /\/(accounts)?$/;

/** Connexion par le formulaire avec le compte de test. */
export async function login(page: Page) {
  await gotoOk(page, '/login');
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel('Mot de passe').fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // Accueil `/` ; un compte sans compte bancaire est ensuite poussé vers /accounts par l'accueil lui-même.
  await expect(page).toHaveURL(HOME_URL, { timeout: 20_000 });
}
