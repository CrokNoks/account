import { test, expect, gotoOk } from './lib/fixtures';
import { loginWithFreshAccount, uniqueName } from './lib/steps';

// docs/recurring.md — créer une opération récurrente (description, jour, montant), la voir, la supprimer.
test('crée une récurrence, la voit, la supprime', async ({ page }) => {
  await loginWithFreshAccount(page);
  await gotoOk(page, '/recurring');

  const description = uniqueName('recurrence');
  await page.getByRole('button', { name: 'Nouvelle récurrence' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Description', { exact: true }).fill(description);
  await sheet.getByLabel('Montant', { exact: true }).fill('-9,99');
  await sheet.getByRole('button', { name: /^Enregistrer ⇧/ }).click();

  const row = page.getByRole('row', { name: new RegExp(description) });
  await expect(row).toBeVisible();
  await expect(row).toContainText(/9,99/);

  page.once('dialog', (d) => d.accept());
  await row.hover();
  await row.getByRole('button').last().click();
  await expect(page.getByRole('row', { name: new RegExp(description) })).toHaveCount(0, { timeout: 20_000 });
});
