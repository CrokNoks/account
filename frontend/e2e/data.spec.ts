import { test, expect, login, gotoOk } from './lib/fixtures';
import { E2E_PREFIX } from './lib/test-data';

// CA5 + CA6 — création d'un compte bancaire puis d'une transaction, affichage, suppression de la transaction.
// Le compte bancaire n'a pas de suppression dans l'UI : la fixture le supprime (avec la session du compte de test).
test('crée un compte et une transaction, les voit, supprime la transaction', async ({ page }) => {
  const stamp = Date.now();
  const accountName = `${E2E_PREFIX}compte-${stamp}`;
  const label = `${E2E_PREFIX}libelle-${stamp}`;

  await page.addInitScript(() => {
    localStorage.setItem(
      'ui-storage',
      JSON.stringify({ state: { completedTours: { dashboard: true, account: true, transactions: true } }, version: 0 }),
    );
  });

  await login(page);

  // Compte bancaire
  await gotoOk(page, '/accounts');
  await page.getByRole('button', { name: 'Ajouter un compte' }).click();
  await page.getByPlaceholder('Compte courant, Épargne...').fill(accountName);
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText(accountName).first()).toBeVisible();

  // Transaction sur ce compte
  await gotoOk(page, '/transactions');
  await page.getByRole('button', { name: 'Ajouter une opération' }).first().click();
  const drawer = page.getByRole('dialog');
  await drawer.getByPlaceholder('Loyer, Courses, Salaire...').fill(label);
  await drawer.getByPlaceholder('0,00').fill('-12,34');
  await drawer.locator('button[type="submit"]').first().click();

  const row = page.getByRole('row', { name: new RegExp(label) });
  await expect(row).toBeVisible();
  await expect(row).toContainText(/12,34/);

  // Suppression de la transaction par l'application
  page.once('dialog', (d) => d.accept());
  await row.hover();
  await row.getByRole('button').last().click();
  await expect(page.getByRole('row', { name: new RegExp(label) })).toHaveCount(0);
});
