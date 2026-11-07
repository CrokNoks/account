import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { activeEntryHref, NAV_ENTRIES, SETTINGS_PAGES } from './nav-config';

const DASHBOARD = join(__dirname, '../../../app/[locale]/(dashboard)');

/**
 * Page -> comment on l'atteint (entrée, Réglages ou sous-page de l'entrée). Les 5 anciennes adresses
 * (/evolution, /flux, /depassements, /calendar, /cashflow) sont retirées volontairement : 404.
 */
const REACHED_BY: Record<string, { entry: string; via: 'entry' | 'settings' | 'subpage' }> = {
  '/': { entry: '/', via: 'entry' },
  '/transactions': { entry: '/transactions', via: 'entry' },
  '/transactions/import': { entry: '/transactions', via: 'subpage' },
  '/analyses': { entry: '/analyses', via: 'entry' },
  '/budgets': { entry: '/budgets', via: 'entry' },
  '/budgets/fixed': { entry: '/budgets', via: 'subpage' },
  '/echeances': { entry: '/echeances', via: 'entry' },
  '/accounts': { entry: '/settings', via: 'settings' },
  '/categories': { entry: '/settings', via: 'settings' },
  '/tags': { entry: '/settings', via: 'settings' },
  '/smart-rules': { entry: '/settings', via: 'settings' },
  '/recurring': { entry: '/settings', via: 'settings' },
};

function pageRoutes(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (!statSync(p).isDirectory()) return f === 'page.tsx' ? [prefix || '/'] : [];
    return pageRoutes(p, `${prefix}/${f}`);
  });
}

describe('aucune page existante ne devient inaccessible', () => {
  // Toutes les pages du dossier, /settings compris : chacune doit figurer dans la table.
  it('chaque page du dossier (dashboard) a une ligne dans la table de rattachement, et inversement', () => {
    expect(pageRoutes(DASHBOARD).sort()).toEqual([...Object.keys(REACHED_BY), '/settings'].sort());
  });

  for (const [route, { entry, via }] of Object.entries(REACHED_BY)) {
    it(`${route} est atteignable (${via} ${entry}) et active l'entrée ${entry}`, () => {
      expect(activeEntryHref(route)).toBe(entry);
      if (via === 'entry') expect(NAV_ENTRIES.map((e) => e.href)).toContain(route);
      if (via === 'settings') expect(SETTINGS_PAGES.map((p) => p.href)).toContain(route);
      if (via === 'subpage') expect(route.startsWith(`${entry}/`)).toBe(true);
    });
  }

  it("les adresses des entrées Analyses et Échéances n'ont pas de redirection non plus", () => {
    expect(readFileSync(join(DASHBOARD, 'analyses/page.tsx'), 'utf8')).not.toMatch(/redirect/);
    expect(readFileSync(join(DASHBOARD, 'echeances/page.tsx'), 'utf8')).not.toMatch(/redirect/);
  });

  it('les 5 anciennes adresses ne sont plus des pages ni des routes connues', () => {
    for (const r of ['/evolution', '/flux', '/depassements', '/calendar', '/cashflow']) {
      expect(pageRoutes(DASHBOARD)).not.toContain(r);
      expect(activeEntryHref(r)).toBeUndefined();
      expect(activeEntryHref(`/fr${r}`)).toBeUndefined();
    }
  });

  it('Réglages est une entrée, atteignable', () => {
    expect(NAV_ENTRIES.map((e) => e.href)).toContain('/settings');
    expect(pageRoutes(DASHBOARD)).toContain('/settings');
    expect(activeEntryHref('/settings')).toBe('/settings');
  });
});

describe('palette de commandes', () => {
  it('propose les 6 entrées (Échéances une seule fois, sans Prévisions) et les 5 pages de Réglages', () => {
    const hrefs = [...NAV_ENTRIES, ...SETTINGS_PAGES].map((p) => p.href);
    expect(hrefs).toEqual([
      '/', '/transactions', '/analyses', '/budgets', '/echeances', '/settings',
      '/accounts', '/categories', '/tags', '/smart-rules', '/recurring',
    ]);
  });
});
