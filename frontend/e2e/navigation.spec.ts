import { test, expect, gotoOk, login } from './lib/fixtures';
import { skipTours } from './lib/steps';

// docs/navigation.md — les 6 entrées du menu, la page Réglages, la déconnexion.
test('le menu mène aux écrans, Réglages liste les pages rattachées, la déconnexion renvoie sur /login', async ({ page }) => {
  test.setTimeout(180_000);
  await skipTours(page);
  await login(page);
  await gotoOk(page, '/transactions');

  const nav = page.getByRole('navigation').first();
  await expect(nav.getByRole('link', { name: /Analyses/ }).first()).toBeVisible({ timeout: 20_000 });
  // Les 4 entrées pointent vers leurs écrans ; on suit l'une d'elles (Budgets).
  for (const [label, href] of [
    ['Analyses', /\/analyses$/],
    ['Budgets', /\/budgets$/],
    ['Échéances', /\/echeances$/],
    ['Réglages', /\/settings$/],
  ] as const) {
    await expect(nav.getByRole('link', { name: new RegExp(label) }).first()).toHaveAttribute('href', href);
  }
  await nav.getByRole('link', { name: /Budgets/ }).first().click();
  await expect(page).toHaveURL(/\/budgets$/, { timeout: 30_000 });

  // Réglages : les 5 pages rattachées y sont listées ; on suit l'une d'elles (Catégories).
  await gotoOk(page, '/settings');
  const main = page.getByRole('main');
  for (const [label, href] of [
    ['Comptes', /\/accounts$/],
    ['Catégories', /\/categories$/],
    ['Tags', /\/tags$/],
    ['Règles', /\/smart-rules$/],
    ['Récurrences', /\/recurring$/],
  ] as const) {
    await expect(main.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('href', href, { timeout: 30_000 });
  }
  await main.getByRole('link', { name: /Catégories/ }).click();
  await expect(page).toHaveURL(/\/categories$/, { timeout: 30_000 });

  await page.getByRole('button', { name: /Déconnexion/ }).first().click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
  await gotoOk(page, '/transactions');
  await expect(page).toHaveURL(/\/login$/);
});

// docs/navigation.md — les anciennes adresses répondent 404 une fois connecté.
test('une ancienne adresse supprimée répond 404', async ({ page }) => {
  await login(page);
  const response = await page.goto('/evolution');
  expect(response?.status()).toBe(404);
});
