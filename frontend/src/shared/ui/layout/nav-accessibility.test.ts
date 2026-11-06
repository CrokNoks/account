import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ATTACHED_PAGES, activeEntryHref, NAV_ENTRIES, SETTINGS_PAGES, tabsFor } from './nav-config';

const DASHBOARD = join(__dirname, '../../../app/[locale]/(dashboard)');

/** Ancienne route -> comment on l'atteint désormais (entrée, onglet, Réglages ou sous-page de l'entrée). */
const REACHED_BY: Record<string, { entry: string; via: 'entry' | 'tab' | 'settings' | 'subpage' }> = {
  '/': { entry: '/', via: 'entry' },
  '/transactions': { entry: '/transactions', via: 'entry' },
  '/transactions/import': { entry: '/transactions', via: 'subpage' },
  '/evolution': { entry: '/evolution', via: 'entry' },
  '/flux': { entry: '/evolution', via: 'tab' },
  '/depassements': { entry: '/evolution', via: 'tab' },
  '/budgets': { entry: '/budgets', via: 'entry' },
  '/budgets/fixed': { entry: '/budgets', via: 'subpage' },
  '/calendar': { entry: '/calendar', via: 'entry' },
  '/cashflow': { entry: '/calendar', via: 'tab' },
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
      if (via === 'tab') expect(tabsFor(entry).map((t) => t.href)).toContain(route);
      if (via === 'settings') expect(SETTINGS_PAGES.map((p) => p.href)).toContain(route);
      if (via === 'subpage') expect(route.startsWith(`${entry}/`)).toBe(true);
    });
  }

  it('Réglages est une entrée, atteignable', () => {
    expect(NAV_ENTRIES.map((e) => e.href)).toContain('/settings');
    expect(pageRoutes(DASHBOARD)).toContain('/settings');
    expect(activeEntryHref('/settings')).toBe('/settings');
  });
});

describe('palette de commandes', () => {
  it('propose les 6 entrées, les pages rattachées et les 5 pages de Réglages', () => {
    const hrefs = [...NAV_ENTRIES, ...ATTACHED_PAGES, ...SETTINGS_PAGES].map((p) => p.href);
    expect(hrefs).toEqual([
      '/', '/transactions', '/evolution', '/budgets', '/calendar', '/settings',
      '/flux', '/depassements', '/cashflow',
      '/accounts', '/categories', '/tags', '/smart-rules', '/recurring',
    ]);
  });
});
