/**
 * Garde-fou de cible (CA7) : les tests Playwright ne tournent jamais contre autre chose que la recette.
 * Liste blanche (jamais liste noire) : tout ce qui n'y figure pas est refusé.
 * Module sans dépendance : importé aussi par les scripts Node (création du compte de test).
 */

export const RECETTE_SUPABASE_REF = 'zcoteefoqzyoqpzeqzql';
export const RECETTE_FRONT_URL = 'https://account-recette.web.app';

const RECETTE_FRONT_HOST = 'account-recette.web.app';
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];
const RECETTE_BACKEND_HOSTS = [
  `${RECETTE_SUPABASE_REF}.supabase.co`,
  'europe-west1-account-recette.cloudfunctions.net',
];

function refuse(message: string): never {
  throw new Error(`Refus de lancer les tests Playwright : ${message}. Seules la recette (${RECETTE_FRONT_URL}) et localhost branché sur la recette sont autorisés.`);
}

function parse(url: string, what: string): URL {
  try {
    return new URL(url);
  } catch {
    return refuse(`${what} illisible`);
  }
}

function isLocal(u: URL): boolean {
  return (u.protocol === 'http:' || u.protocol === 'https:') && !u.username && !u.password && LOCAL_HOSTS.includes(u.hostname);
}

/** Refuse tout front qui n'est pas la recette ou localhost, et tout service référencé hors recette. */
export function assertAllowedTarget(baseUrl: string, referencedUrls: string[]): void {
  const base = parse(baseUrl, 'URL cible');
  const baseIsRecette =
    base.protocol === 'https:' && !base.username && !base.password && base.hostname === RECETTE_FRONT_HOST;
  if (!baseIsRecette && !isLocal(base)) {
    refuse(`la cible ${base.origin} n'est ni la recette ni localhost`);
  }

  let supabaseSeen = false;
  for (const raw of referencedUrls) {
    const u = parse(raw, 'URL de service');
    if (!RECETTE_BACKEND_HOSTS.includes(u.hostname) && !isLocal(u)) {
      refuse(`la cible parle à ${u.origin}, qui n'est pas la recette`);
    }
    if (u.hostname === `${RECETTE_SUPABASE_REF}.supabase.co`) supabaseSeen = true;
  }
  if (!supabaseSeen) {
    refuse(`aucun projet Supabase identifiable dans la cible, impossible de prouver qu'il s'agit de la recette`);
  }
}

/** Création du compte de test : uniquement le projet Supabase de recette (https, hôte exact). */
export function assertRecetteSupabase(supabaseUrl: string): void {
  const u = parse(supabaseUrl, 'URL Supabase');
  if (u.protocol !== 'https:' || u.username || u.password || u.hostname !== `${RECETTE_SUPABASE_REF}.supabase.co`) {
    refuse(`le projet Supabase ${u.origin} n'est pas la recette (${RECETTE_SUPABASE_REF})`);
  }
}

/** Origines Supabase et Cloud Functions trouvées dans du code ou du HTML servi par le front. */
export function findBackendUrls(source: string): string[] {
  const found = source.match(/https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:supabase\.co|cloudfunctions\.net)/gi) ?? [];
  return [...new Set(found.map((u) => u.toLowerCase()))];
}

const GUARDED_SUFFIXES = ['.supabase.co', '.cloudfunctions.net', '.web.app', '.firebaseapp.com', '.run.app'];

/**
 * Filet pendant le parcours : une requête du navigateur vers un service Supabase/Firebase/Cloud Run
 * qui n'est pas celui de la recette doit être coupée (le HTML initial ne montre pas toujours toutes les URL).
 */
export function isForbiddenRequest(requestUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(requestUrl);
  } catch {
    return false;
  }
  if (isLocal(u) || RECETTE_BACKEND_HOSTS.includes(u.hostname) || u.hostname === RECETTE_FRONT_HOST) return false;
  return GUARDED_SUFFIXES.some((suffix) => u.hostname.endsWith(suffix));
}
