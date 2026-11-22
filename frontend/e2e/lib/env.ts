import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Fichier ignoré par git (`.env*`) qui porte les identifiants du compte de test. Les commandes npm tournent depuis `frontend/`. */
export const E2E_ENV_FILE = resolve(process.cwd(), '.env.e2e');

export function loadE2eEnv(): void {
  if (existsSync(E2E_ENV_FILE)) process.loadEnvFile(E2E_ENV_FILE);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable ${name} absente. Créez le compte de test : npm run e2e:create-user (voir specs/playwright-recette/procedure.md).`);
  }
  return value;
}
