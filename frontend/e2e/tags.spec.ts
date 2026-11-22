import { test, expect, gotoOk } from './lib/fixtures';
import { loginWithFreshAccount, uniqueName } from './lib/steps';

// docs/tags.md — créer un tag, le voir, le supprimer.
test('crée un tag, le voit, le supprime', async ({ page }) => {
  await loginWithFreshAccount(page);
  await gotoOk(page, '/tags');

  const name = uniqueName('tag');
  await page.getByRole('button', { name: 'Nouveau tag' }).click();
  await page.getByRole('dialog').getByLabel('Nom', { exact: true }).fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  const card = page.locator('div.group', { hasText: name });
  await expect(card).toBeVisible();

  page.once('dialog', (d) => d.accept());
  await card.hover();
  await card.getByTitle('Supprimer').click();
  await expect(page.getByText(name)).toHaveCount(0, { timeout: 20_000 });
});
