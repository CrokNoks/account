import { test, expect, gotoOk } from './lib/fixtures';
import { loginWithFreshAccount } from './lib/steps';

// docs/reporting.md, docs/budgets.md, docs/periods.md — les écrans s'affichent pour un compte neuf,
// et une période se crée depuis « Gérer les périodes » (les dates suggérées sont reprises telles quelles).
test('un compte neuf : Aujourd’hui invite à créer une période, la période se crée, Analyses et Échéances s’affichent', async ({ page }) => {
  test.setTimeout(180_000);
  await loginWithFreshAccount(page);

  await gotoOk(page, '/');
  await expect(page.getByText('Aucune période pour ce compte')).toBeVisible();

  await gotoOk(page, '/budgets');
  await page.getByText('Gérer les périodes').click();
  await page.getByRole('button', { name: 'Nouvelle période' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('input[type="date"]').first()).not.toHaveValue('');
  await sheet.getByRole('button', { name: 'Ajouter' }).click();
  await expect(sheet).toHaveCount(0);

  await gotoOk(page, '/');
  await expect(page.getByText('Aucune période pour ce compte')).toHaveCount(0);

  await gotoOk(page, '/analyses');
  await expect(page).toHaveURL(/\/analyses$/);
  await expect(page.getByRole('tab', { name: /Répartition/ })).toBeVisible();

  await gotoOk(page, '/echeances');
  await expect(page).toHaveURL(/\/echeances$/);
});
