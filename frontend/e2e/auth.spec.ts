import { test, expect, login, gotoOk, HOME_URL } from './lib/fixtures';

// CA4 — règles de docs/auth.md : sans session /login, connecté sur / ; connecté sur /login renvoie sur /.
test.describe('connexion', () => {
  test('sans session, une page protégée renvoie sur /login', async ({ page }) => {
    await gotoOk(page, '/transactions');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('le compte de test se connecte et arrive sur l’accueil', async ({ page }) => {
    await login(page);
    await expect(page).not.toHaveURL(/login/);

    // Connecté, /login renvoie sur l'accueil.
    await gotoOk(page, '/login');
    await expect(page).toHaveURL(HOME_URL);
  });

  test('un mauvais mot de passe reste sur /login avec une erreur', async ({ page }) => {
    await gotoOk(page, '/login');
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Échec de la connexion')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
