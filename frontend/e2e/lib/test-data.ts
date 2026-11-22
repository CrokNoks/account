import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertRecetteSupabase } from './target-guard';
import { requireEnv } from './env';

/** Préfixe de tout ce que les parcours créent : le nettoyage ne touche que cela. */
export const E2E_PREFIX = 'e2e-';

export async function signInTestUser(): Promise<{ client: SupabaseClient; userId: string }> {
  const url = requireEnv('E2E_SUPABASE_URL');
  assertRecetteSupabase(url);
  const client = createClient(url, requireEnv('E2E_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: requireEnv('E2E_USER_EMAIL'),
    password: requireEnv('E2E_USER_PASSWORD'),
  });
  if (error || !data.user) throw new Error('Connexion du compte de test impossible (le compte existe-t-il ? npm run e2e:create-user).');
  return { client, userId: data.user.id };
}

/**
 * Supprime les comptes bancaires créés par les parcours (propriétaire = compte de test, nom commençant par `prefix`,
 * `e2e-` par défaut),
 * leurs transactions partent en cascade. Retourne ce qui reste (doit être 0 comptes, 0 transactions).
 */
export async function cleanupTestData(prefix = E2E_PREFIX): Promise<{ accounts: number; transactions: number }> {
  const { client, userId } = await signInTestUser();
  try {
    const { error } = await client.from('accounts').delete().eq('owner_id', userId).like('name', `${prefix}%`);
    if (error) throw error;
    return await countLeftovers(client, userId, prefix);
  } finally {
    await client.auth.signOut();
  }
}

async function countLeftovers(client: SupabaseClient, userId: string, prefix = E2E_PREFIX) {
  const accounts = await client.from('accounts').select('id', { count: 'exact', head: true }).eq('owner_id', userId).like('name', `${prefix}%`);
  const all = await client.from('accounts').select('id').eq('owner_id', userId).like('name', `${prefix}%`);
  const ids = (all.data ?? []).map((a) => a.id as string);
  let transactions = 0;
  if (ids.length) {
    const t = await client.from('transactions').select('id', { count: 'exact', head: true }).in('account_id', ids);
    transactions = t.count ?? 0;
  }
  return { accounts: accounts.count ?? 0, transactions };
}

/** Lecture seule pour la vérification de CA6 : combien reste-t-il de données de test ? */
export async function leftovers(): Promise<{ accounts: number; transactions: number }> {
  const { client, userId } = await signInTestUser();
  try {
    return await countLeftovers(client, userId);
  } finally {
    await client.auth.signOut();
  }
}
