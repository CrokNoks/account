import { test, expect, gotoOk } from './lib/fixtures';
import { loginWithFreshAccount, uniqueName } from './lib/steps';

// docs/categories.md — créer une catégorie (nom + type) et la voir classée dans son groupe.
test('crée une catégorie de dépense puis une de revenu, les voit dans leur groupe', async ({ page }) => {
  await loginWithFreshAccount(page);
  await gotoOk(page, '/categories');

  const expense = uniqueName('depense');
  await page.getByRole('button', { name: 'Nouvelle catégorie' }).click();
  await page.getByRole('dialog').getByLabel('Nom', { exact: true }).fill(expense);
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText(expense)).toBeVisible();

  const income = uniqueName('revenu');
  await page.getByRole('button', { name: 'Nouvelle catégorie' }).click();
  await page.getByRole('dialog').getByLabel('Nom', { exact: true }).fill(income);
  await page.getByRole('dialog').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Revenu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText(income)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Revenu/ })).toBeVisible();
});
