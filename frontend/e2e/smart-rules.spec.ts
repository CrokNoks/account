import { test, expect, gotoOk } from './lib/fixtures';
import { loginWithFreshAccount, uniqueName } from './lib/steps';

// docs/smart-rules.md — créer une règle (motif, priorité), la voir, la supprimer.
test('crée une règle, la voit, la supprime', async ({ page }) => {
  await loginWithFreshAccount(page);
  await gotoOk(page, '/smart-rules');

  const pattern = uniqueName('motif').toUpperCase();
  await page.getByRole('button', { name: 'Nouvelle règle' }).click();
  await page.getByPlaceholder('Ex: NETFLIX, TOTAL, AMZN...').fill(pattern);
  await page.getByRole('button', { name: 'Créer la règle' }).click();

  const row = page.getByRole('row', { name: new RegExp(pattern) });
  await expect(row).toBeVisible();

  page.once('dialog', (d) => d.accept());
  await row.hover();
  await row.getByRole('button').last().click();
  await expect(page.getByRole('row', { name: new RegExp(pattern) })).toHaveCount(0, { timeout: 20_000 });
});
