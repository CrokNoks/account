import { assertAllowedBase, assertAllowedTarget, findBackendUrls, RECETTE_FRONT_URL } from './lib/target-guard';
import { loadE2eEnv } from './lib/env';
import { cleanupTestData } from './lib/test-data';

/** La recette (rendu serveur Firebase) répond parfois 500 à froid : quelques essais avant de conclure. */
async function fetchOk(url: string | URL): Promise<string> {
  let status = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url);
    status = res.status;
    if (res.ok) return res.text();
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`La cible ne répond pas correctement (${url}, HTTP ${status}) : impossible de vérifier qu'il s'agit de la recette.`);
}

/** Lit /login et les scripts qu'il charge pour retrouver les services (Supabase, API) que le front vise. */
async function backendUrlsOf(baseUrl: string): Promise<string[]> {
  const html = await fetchOk(new URL('/login', baseUrl));
  // Seuls les scripts du même hôte que la cible sont suivis (la cible est déjà validée).
  const origin = new URL(baseUrl).origin;
  const scripts = [...html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+\.js[^"]*)"/g)]
    .map((m) => new URL(m[1], baseUrl))
    .filter((u) => u.origin === origin)
    .map((u) => u.href);
  const sources = [html];
  for (const src of [...new Set(scripts)]) sources.push(await fetchOk(src));
  return [...new Set(sources.flatMap(findBackendUrls))];
}

export default async function globalSetup() {
  loadE2eEnv();
  const baseUrl = process.env.E2E_BASE_URL || RECETTE_FRONT_URL;
  // 0. Hôte validé par la liste blanche avant toute requête vers la cible.
  assertAllowedBase(baseUrl);
  // 1. Avant toute connexion ou création de données : la cible est-elle la recette ?
  assertAllowedTarget(baseUrl, await backendUrlsOf(baseUrl));
  // 2. Reste d'un passage interrompu (kill) : on ne supprime que les données préfixées du compte de test.
  const left = await cleanupTestData();
  if (left.accounts || left.transactions) throw new Error('Nettoyage initial incomplet.');
}
