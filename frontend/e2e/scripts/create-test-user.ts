/**
 * Crée (ou remet à jour) le compte de test dans l'Auth Supabase de la RECETTE, et nulle part ailleurs.
 * Idempotent. Écrit les identifiants dans frontend/.env.e2e (ignoré par git).
 * La clé de service de recette n'est ni écrite ni journalisée : variable E2E_SERVICE_ROLE_KEY,
 * ou lue le temps de la commande via la CLI Supabase avec --project-ref explicite (jamais --linked).
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { E2E_ENV_FILE, loadE2eEnv } from '../lib/env.ts';
import { RECETTE_SUPABASE_REF, assertRecetteSupabase } from '../lib/target-guard.ts';

loadE2eEnv();

const url = `https://${RECETTE_SUPABASE_REF}.supabase.co`;
// Garde-fou de cible : avant toute connexion. Une URL surchargée par l'environnement doit aussi être la recette.
assertRecetteSupabase(url);
if (process.env.E2E_SUPABASE_URL) assertRecetteSupabase(process.env.E2E_SUPABASE_URL);

function readKeys(): { service: string; anon: string } {
  if (process.env.E2E_SERVICE_ROLE_KEY && process.env.E2E_SUPABASE_ANON_KEY) {
    return { service: process.env.E2E_SERVICE_ROLE_KEY, anon: process.env.E2E_SUPABASE_ANON_KEY };
  }
  const out = execFileSync('supabase', ['projects', 'api-keys', '--project-ref', RECETTE_SUPABASE_REF, '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let keys: { name?: string; id?: string; api_key: string }[];
  try {
    keys = JSON.parse(out);
  } catch {
    // Message fixe : la sortie contient des clés, elle ne doit jamais être affichée.
    throw new Error('La sortie de la CLI Supabase (projects api-keys) est illisible : clés non récupérées.');
  }
  const find = (n: string) => keys.find((k) => k.name === n || k.id === n)?.api_key;
  const service = find('service_role');
  const anon = find('anon');
  if (!service || !anon) throw new Error('Clés service_role/anon introuvables dans la réponse de la CLI.');
  return { service, anon };
}

const email = process.env.E2E_USER_EMAIL || 'e2e-playwright@example.com';
const password = process.env.E2E_USER_PASSWORD || randomBytes(18).toString('base64url');
const { service, anon } = readKeys();

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserId(): Promise<string | undefined> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) return undefined;
  }
  return undefined;
}

const existing = await findUserId();
if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing, { password, email_confirm: true });
  if (error) throw error;
  console.log('Compte de test déjà présent dans la recette : mot de passe et confirmation remis à jour.');
} else {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  console.log('Compte de test créé dans la recette.');
}

writeFileSync(
  E2E_ENV_FILE,
  [
    `E2E_SUPABASE_URL=${url}`,
    `E2E_SUPABASE_ANON_KEY=${anon}`,
    `E2E_USER_EMAIL=${email}`,
    `E2E_USER_PASSWORD=${password}`,
    '',
  ].join('\n'),
  { mode: 0o600 },
);
console.log(`Identifiants écrits dans ${E2E_ENV_FILE} (ignoré par git).`);
