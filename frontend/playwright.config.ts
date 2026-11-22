import { defineConfig, devices } from '@playwright/test';
import { loadE2eEnv } from './e2e/lib/env';
import { RECETTE_FRONT_URL } from './e2e/lib/target-guard';

loadE2eEnv();

// Cible : la recette par défaut ; E2E_BASE_URL pour un front local (ex. `next dev` : http://localhost:3000).
// Le garde-fou (globalSetup) refuse toute autre cible avant la moindre connexion.
const baseURL = process.env.E2E_BASE_URL || RECETTE_FRONT_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts', // vitest ne lit que *.test.ts : aucun fichier n'est ramassé par les deux
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  // Un seul nouvel essai : la recette répond parfois 500/503 ou coupe une navigation (démarrage à froid), sans lien avec le parcours.
  // Un test qui ne passe qu'au 2e essai est signalé « flaky » dans le rapport.
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
