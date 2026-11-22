import { test, expect } from '@playwright/test';
import { E2E_PREFIX, cleanupTestData, signInTestUser } from './lib/test-data';

// CA6 — le nettoyage supprime ce que les parcours ont créé (préfixe e2e-) et rien d'autre.
test('le nettoyage ne supprime que les comptes du préfixe demandé, propriété du compte de test', async () => {
  const { client, userId } = await signInTestUser();
  const stamp = Date.now();
  const runPrefix = `${E2E_PREFIX}nettoyage-${stamp}-`;
  const mine = await client.from('accounts').insert({ name: `${runPrefix}a`, owner_id: userId }).select('id').single();
  const other = await client.from('accounts').insert({ name: `${E2E_PREFIX}conserve-${stamp}`, owner_id: userId }).select('id').single();
  expect(mine.error).toBeNull();
  expect(other.error).toBeNull();

  try {
    // Nettoyage limité au préfixe de ce test : l'autre compte e2e- (rattrapé par le nettoyage suivant) reste.
    expect(await cleanupTestData(runPrefix)).toEqual({ accounts: 0, transactions: 0 });
    const gone = await client.from('accounts').select('id').eq('id', mine.data!.id);
    expect(gone.data).toHaveLength(0);

    const stillThere = await client.from('accounts').select('id').eq('id', other.data!.id);
    expect(stillThere.data).toHaveLength(1);
  } finally {
    await client.from('accounts').delete().eq('id', other.data!.id).eq('owner_id', userId);
    await client.auth.signOut();
  }
});
