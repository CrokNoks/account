import { describe, expect, it } from 'vitest';
import {
  assertAllowedBase,
  assertAllowedTarget,
  assertRecetteSupabase,
  findBackendUrls,
  isForbiddenRequest,
} from './target-guard';

const RECETTE_FRONT = 'https://account-recette.web.app';
const RECETTE_SUPABASE = 'https://zcoteefoqzyoqpzeqzql.supabase.co';
const RECETTE_API = 'https://europe-west1-account-recette.cloudfunctions.net/api';
const PROD_SUPABASE = 'https://qemrhlovsmnhoxlkhzmv.supabase.co';

describe('assertAllowedTarget (CA7, liste blanche)', () => {
  it('accepte la recette', () => {
    expect(() => assertAllowedTarget(RECETTE_FRONT, [RECETTE_SUPABASE, RECETTE_API])).not.toThrow();
  });

  it('accepte localhost et 127.0.0.1 parlant à la recette', () => {
    expect(() => assertAllowedTarget('http://localhost:3000', [RECETTE_SUPABASE])).not.toThrow();
    expect(() => assertAllowedTarget('http://127.0.0.1:3100/login', [RECETTE_SUPABASE])).not.toThrow();
  });

  it.each([
    ['front de prod (Firebase)', 'https://account-c6a3f.web.app'],
    ['front de prod (firebaseapp)', 'https://account-c6a3f.firebaseapp.com'],
    ['cible inconnue', 'https://example.com'],
    ['nom de domaine qui contient la recette', 'https://account-recette.web.app.evil.com'],
    ['identifiant avant un autre hôte', 'https://localhost@account-c6a3f.web.app'],
    ['recette en http', 'http://account-recette.web.app'],
    ['URL illisible', 'pas une url'],
    ['vide', ''],
  ])('refuse %s', (_nom, url) => {
    expect(() => assertAllowedTarget(url, [RECETTE_SUPABASE])).toThrow(/refus/i);
  });

  it('refuse un front local qui parle à la prod Supabase', () => {
    expect(() => assertAllowedTarget('http://localhost:3000', [PROD_SUPABASE])).toThrow(/refus/i);
  });

  it('refuse dès qu une seule référence est hors liste blanche', () => {
    expect(() =>
      assertAllowedTarget(RECETTE_FRONT, [RECETTE_SUPABASE, PROD_SUPABASE]),
    ).toThrow(/refus/i);
  });

  it('refuse une API de prod', () => {
    expect(() =>
      assertAllowedTarget('http://localhost:3000', [
        RECETTE_SUPABASE,
        'https://europe-west1-account-c6a3f.cloudfunctions.net/api',
      ]),
    ).toThrow(/refus/i);
  });

  it('refuse quand aucun projet Supabase n est identifiable (impossible de prouver la cible)', () => {
    expect(() => assertAllowedTarget('http://localhost:3000', [])).toThrow(/refus/i);
  });
});

describe('assertRecetteSupabase (création du compte de test, CA3 + CA7)', () => {
  it('accepte uniquement le projet de recette', () => {
    expect(() => assertRecetteSupabase(RECETTE_SUPABASE)).not.toThrow();
  });

  it.each([PROD_SUPABASE, 'http://127.0.0.1:54321', 'https://example.com', '', 'nope'])(
    'refuse %s',
    (url) => {
      expect(() => assertRecetteSupabase(url)).toThrow(/refus/i);
    },
  );
});

describe('findBackendUrls', () => {
  it('extrait les URL Supabase et Cloud Functions du code servi', () => {
    const code = `a="${RECETTE_SUPABASE}";b='${RECETTE_API}/x';c="https://cdn.example.com/y.js"`;
    expect(findBackendUrls(code).sort()).toEqual(
      [RECETTE_SUPABASE, 'https://europe-west1-account-recette.cloudfunctions.net'].sort(),
    );
  });

  it('retrouve une URL de prod cachée dans un fichier', () => {
    expect(findBackendUrls(`x="${PROD_SUPABASE}/auth/v1"`)).toEqual([PROD_SUPABASE]);
  });
});

describe('isForbiddenRequest (filet pendant le parcours)', () => {
  it.each([
    PROD_SUPABASE + '/auth/v1/token',
    'https://europe-west1-account-c6a3f.cloudfunctions.net/api/accounts',
    'https://account-c6a3f.web.app/',
    'https://ssraccountc6a3f-xyz-uc.a.run.app/',
  ])('coupe %s', (url) => {
    expect(isForbiddenRequest(url)).toBe(true);
  });

  it.each([
    RECETTE_SUPABASE + '/auth/v1/token',
    RECETTE_API + '/accounts',
    RECETTE_FRONT + '/login',
    'http://localhost:3000/_next/x.js',
    'https://fonts.gstatic.com/a.woff2',
  ])('laisse passer %s', (url) => {
    expect(isForbiddenRequest(url)).toBe(false);
  });
});

describe('assertAllowedBase', () => {
  it('refuse la prod sans rien d autre à examiner', () => {
    expect(() => assertAllowedBase('https://account-c6a3f.web.app')).toThrow(/refus/i);
  });
  it('accepte la recette et localhost', () => {
    expect(() => assertAllowedBase(RECETTE_FRONT)).not.toThrow();
    expect(() => assertAllowedBase('http://localhost:3000')).not.toThrow();
  });
});
