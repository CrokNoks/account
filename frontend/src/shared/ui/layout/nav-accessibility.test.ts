import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ATTACHED_PAGES, activeEntryHref, NAV_ENTRIES, SETTINGS_PAGES, tabsFor } from './nav-config';

const DASHBOARD = join(__dirname, '../../../app/[locale]/(dashboard)');

/**
 * Ancienne route -> comment on l'atteint désormais (entrée, onglet de pages, onglet de l'écran Analyses,
 * Réglages ou sous-page de l'entrée).
 */
const REACHED_BY: Record<string, { entry: string; via: 'entry' | 'tab' | 'screen-tab' | 'settings' | 'subpage'; screenTab?: string }> = {
  '/': { entry: '/', via: 'entry' },
  '/transactions': { entry: '/transactions', via: 'entry' },
  '/transactions/import': { entry: '/transactions', via: 'subpage' },
  '/analyses': { entry: '/analyses', via: 'entry' },
  '/evolution': { entry: '/analyses', via: 'screen-tab', screenTab: 'evolution' },
  '/flux': { entry: '/analyses', via: 'screen-tab', screenTab: 'breakdown' },
  '/depassements': { entry: '/analyses', via: 'screen-tab', screenTab: 'overruns' },
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

  for (const [route, { entry, via, screenTab }] of Object.entries(REACHED_BY)) {
    it(`${route} est atteignable (${via} ${entry}) et active l'entrée ${entry}`, () => {
      expect(activeEntryHref(route)).toBe(entry);
      if (via === 'entry') expect(NAV_ENTRIES.map((e) => e.href)).toContain(route);
      if (via === 'tab') expect(tabsFor(entry).map((t) => t.href)).toContain(route);
      if (via === 'screen-tab') {
        // Un onglet de l'écran Analyses : la page affiche l'écran sur cet onglet, sans redirection.
        const page = readFileSync(join(DASHBOARD, route, 'page.tsx'), 'utf8');
        const screen = readFileSync(join(__dirname, '../../../features/reporting/ui/analyses-screen.tsx'), 'utf8');
        expect(page).toContain(`<AnalysesScreen initialTab="${screenTab}" />`);
        expect(page).not.toMatch(/redirect/);
        expect(screen).toContain(`'${screenTab}'`);
        expect(tabsFor(entry)).toEqual([]);
      }
      if (via === 'settings') expect(SETTINGS_PAGES.map((p) => p.href)).toContain(route);
      if (via === 'subpage') expect(route.startsWith(`${entry}/`)).toBe(true);
    });
  }

  it("l'adresse de l'entrée Analyses n'a pas de redirection non plus", () => {
    expect(readFileSync(join(DASHBOARD, 'analyses/page.tsx'), 'utf8')).not.toMatch(/redirect/);
  });

  it('Réglages est une entrée, atteignable', () => {
    expect(NAV_ENTRIES.map((e) => e.href)).toContain('/settings');
    expect(pageRoutes(DASHBOARD)).toContain('/settings');
    expect(activeEntryHref('/settings')).toBe('/settings');
  });
});

describe('palette de commandes', () => {
  it('propose les 6 entrées, les pages rattachées (ni Flux ni Dépassements : onglets de l\'écran Analyses) et les 5 pages de Réglages', () => {
    const hrefs = [...NAV_ENTRIES, ...ATTACHED_PAGES, ...SETTINGS_PAGES].map((p) => p.href);
    expect(hrefs).toEqual([
      '/', '/transactions', '/analyses', '/budgets', '/calendar', '/settings',
      '/cashflow',
      '/accounts', '/categories', '/tags', '/smart-rules', '/recurring',
    ]);
  });
});
