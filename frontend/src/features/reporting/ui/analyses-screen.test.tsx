import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { AnalysesScreen } from './analyses-screen';

const push = vi.fn();
const state = vi.hoisted(() => ({
  periods: [] as unknown[],
  overruns: { periods: [] } as unknown,
  comparison: null as unknown,
  evolution: [] as unknown[],
  chart: undefined as unknown,
  comparisonArgs: [] as unknown[],
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/fr/analyses' }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1', activePeriodId: 'p-active' }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({
  usePeriods: () => ({ data: state.periods, isLoading: false }),
}));
vi.mock('../api/use-overruns', () => ({
  useOverrunsByPeriod: () => ({ data: state.overruns, isLoading: false, isError: false }),
  useCategoryOverrunsChart: () => ({ data: state.chart, isLoading: false }),
}));
vi.mock('../api/use-period-comparison', () => ({
  usePeriodComparison: (...args: unknown[]) => {
    state.comparisonArgs = args;
    return { data: state.comparison, isLoading: false, isError: false };
  },
}));
vi.mock('../api/use-evolution', () => ({
  useEvolution: () => ({ data: state.evolution, isLoading: false }),
}));
vi.mock('@/features/categories/ui/category-selector', () => ({
  CategorySelector: ({ onChange, 'aria-label': label }: { onChange: (v: string) => void; 'aria-label'?: string }) => (
    <button aria-label={label} onClick={() => onChange('courses')}>choisir</button>
  ),
}));

const mk = (n: number, isActive = false) => ({
  id: `p${n}`,
  startDate: `2026-${String(n).padStart(2, '0')}-01T00:00:00.000Z`,
  endDate: `2026-${String(n).padStart(2, '0')}-28T00:00:00.000Z`,
  isActive,
});

const pt = (categoryId: string, period1Real: string, period2Real: string, percentageDiff: number) => ({
  categoryId, name: categoryId, period1Real, period2Real, diff: '0', percentageDiff,
});

const renderScreen = (initialTab?: 'breakdown' | 'evolution' | 'overruns') =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <AnalysesScreen initialTab={initialTab} />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  push.mockClear();
  state.periods = [mk(1), mk(2), mk(3, true)];
  state.overruns = { periods: [] };
  state.comparison = null;
  state.evolution = [];
  state.chart = undefined;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe("écran Analyses : onglets", () => {
  it('propose Répartition, Évolution et Dépassements, ouvert sur Répartition par défaut', () => {
    renderScreen();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Répartition', 'Évolution', 'Dépassements']);
    expect(screen.getByRole('tab', { name: 'Répartition' }).getAttribute('aria-selected')).toBe('true');
    // Un seul titre par écran : celui de l'en-tête, la page n'en répète pas.
    expect(screen.queryByRole('heading', { level: 2, name: 'Analyses' })).toBeNull();
    expect(screen.queryByText(fr.Reporting.analyses.desc)).toBeNull();
  });

  it.each([
    ['evolution', 'Évolution'],
    ['overruns', 'Dépassements'],
    ['breakdown', 'Répartition'],
  ] as const)("s'ouvre sur l'onglet %s quand l'adresse le demande", (initial, label) => {
    renderScreen(initial);
    expect(screen.getByRole('tab', { name: label }).getAttribute('aria-selected')).toBe('true');
  });

  it('changer d\'onglet ne navigue pas : pas de lien dans la barre, aucun push, même page', () => {
    renderScreen('breakdown');
    const list = screen.getByRole('tablist');
    expect(within(list).queryAllByRole('link')).toHaveLength(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Dépassements' }));
    expect(screen.getByRole('tab', { name: 'Dépassements' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Répartition' }).getAttribute('aria-selected')).toBe('false');
    expect(push).not.toHaveBeenCalled();
  });

  it('chaque onglet a au moins 44 px de haut (cible tactile)', () => {
    renderScreen();
    for (const tab of screen.getAllByRole('tab')) expect(tab.className).toContain('min-h-11');
  });
});

describe('Répartition', () => {
  it('sans période fermée : un message, ni erreur ni tableau', () => {
    state.periods = [mk(3, true)];
    renderScreen('breakdown');
    expect(screen.getByTestId('breakdown-no-period').textContent).toContain('Aucune période fermée');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('avec une seule période fermée : montants et « première période disponible », aucun écart ni « Nouveau »', () => {
    state.periods = [mk(1), mk(2, true)];
    state.comparison = {
      income: [], savings: [], transfers: [],
      expenses: [pt('courses', '-12000', '-12000', 0), pt('loisirs', '-500', '-500', 0)],
    };
    renderScreen('breakdown');
    expect(screen.getByTestId('breakdown-first-period').textContent).toContain('Première période disponible');
    expect(screen.getAllByTestId('breakdown-row')).toHaveLength(2);
    expect(screen.queryAllByTestId('comparison-gap')).toHaveLength(0);
    expect(screen.queryByText('Nouveau')).toBeNull();
    // La même période est passée deux fois au back (compareWith est obligatoire).
    expect(state.comparisonArgs.slice(1)).toEqual(['p1', 'p1']);
  });

  it('avec deux périodes fermées : la dernière face à la précédente, jamais la période active ; écarts, signe et « Nouveau »', () => {
    state.periods = [mk(1), mk(2), mk(3, true)];
    state.comparison = {
      income: [], savings: [], transfers: [],
      expenses: [pt('courses', '-10000', '-12000', 20), pt('loisirs', '0', '-500', 0), pt('sport', '-3000', '-1500', -50)],
    };
    renderScreen('breakdown');
    expect(state.comparisonArgs.slice(1)).toEqual(['p2', 'p1']);
    expect(screen.getByTestId('breakdown-total').textContent).toMatch(/140,00/);
    const gaps = screen.getAllByTestId('comparison-gap').map((g) => g.textContent!.replace(/[\u00a0\u202f]/g, ' '));
    expect(gaps).toEqual(['+20,00 € +20 %', '-15,00 € -50 %', 'Nouveau']) // plus gros montant d'abord;
    expect(screen.queryByTestId('breakdown-first-period')).toBeNull();
  });
});

describe('Répartition : remboursement', () => {
  it("un réel positif sur une dépense n'est ni une dépense affichée ni retranché du total", () => {
    state.comparison = {
      income: [], savings: [], transfers: [],
      expenses: [pt('courses', '-12000', '-12000', 0), pt('imprevus', '0', '3462', 0)],
    };
    renderScreen('breakdown');
    const cells = screen.getAllByTestId('breakdown-row').map((r) => r.textContent!.replace(/[\u00a0\u202f]/g, ' '));
    expect(cells[1]).toContain('imprevus');
    expect(cells[1]).not.toContain('34,62');
    expect(screen.getByTestId('breakdown-total').textContent).toMatch(/120,00/);
  });
});

describe('Répartition : épargne', () => {
  it("l'écart d'une ligne d'épargne est neutre, celui d'une dépense garde sa couleur", () => {
    state.comparison = {
      income: [], transfers: [],
      expenses: [pt('courses', '-10000', '-12000', 20)],
      savings: [pt('livret', '-1000', '-2000', 100)],
    };
    renderScreen('breakdown');
    const gaps = screen.getAllByTestId('comparison-gap');
    const byText = (t: string) => gaps.find((g) => g.textContent!.replace(/[\u00a0\u202f]/g, ' ') === t)!;
    expect(byText('+10,00 € +100 %').className).toContain('text-muted-foreground');
    expect(byText('+20,00 € +20 %').className).toContain('text-warn');
    expect(screen.getByTestId('chart-legend').textContent).toContain('épargne');
  });
});

describe('Répartition : période affichée égale à la comparaison', () => {
  it("remet la précédente comme comparaison au lieu d'écarts à 0 %", async () => {
    const user = userEvent.setup();
    state.periods = [mk(1), mk(2), mk(3), mk(4, true)];
    state.comparison = { income: [], savings: [], transfers: [], expenses: [pt('courses', '-10000', '-12000', 20)] };
    renderScreen('breakdown');
    // Défaut : p3 face à p2. On affiche p2 : la comparaison ne peut plus être p2.
    expect(state.comparisonArgs.slice(1)).toEqual(['p3', 'p2']);
    await user.click(screen.getByRole('combobox', { name: 'Période affichée' }));
    await user.click(await screen.findByRole('option', { name: /février 2026/i }));
    expect(state.comparisonArgs.slice(1)).toEqual(['p2', 'p1']);
  });
});

describe('Dépassements : tableau catégories x périodes fermées', () => {
  const over = (categoryId: string, overrun: string) => ({ categoryId, name: categoryId, budget: '1000', real: '-9999', overrun });

  it('sans période fermée : message', () => {
    state.overruns = { periods: [] };
    renderScreen('overruns');
    expect(screen.getByTestId('overruns-no-period')).toBeTruthy();
  });

  it('périodes fermées sans aucun dépassement : message, colonnes gardées, pas de ligne', () => {
    state.overruns = { periods: [
      { periodId: 'p2', startDate: mk(2).startDate, endDate: mk(2).endDate, overruns: [] },
      { periodId: 'p1', startDate: mk(1).startDate, endDate: mk(1).endDate, overruns: [] },
    ] };
    renderScreen('overruns');
    expect(screen.getByTestId('overruns-none').textContent).toContain('Aucun dépassement');
    expect(screen.queryAllByTestId('overruns-row')).toHaveLength(0);
    expect(within(screen.getByTestId('overruns-grid')).getAllByRole('columnheader')).toHaveLength(4); // catégorie, 2 périodes, total
  });

  it('une case = excédent du back, « — » sinon, total par catégorie, lien vers Opérations (toutes périodes)', () => {
    state.overruns = { periods: [
      { periodId: 'p2', startDate: mk(2).startDate, endDate: mk(2).endDate, overruns: [over('courses', '1550')] },
      { periodId: 'p1', startDate: mk(1).startDate, endDate: mk(1).endDate, overruns: [over('courses', '2000')] },
    ] };
    renderScreen('overruns');
    const row = screen.getByTestId('overruns-row');
    const cells = within(row).getAllByTestId('overruns-cell').map((c) => c.textContent);
    expect(cells[0]).toMatch(/20,00/);
    expect(cells[1]).toMatch(/15,50/);
    expect(within(row).getByTestId('overruns-total').textContent).toMatch(/35,50/);
    const link = within(row).getByRole('link');
    expect(link.getAttribute('href')).toBe('/transactions?categoryId=courses&period=all');
    expect(screen.getByTestId('overruns-legend').textContent).toContain('factures en attente');
  });

  it('une case sans dépassement affiche « — »', () => {
    state.overruns = { periods: [
      { periodId: 'p2', startDate: mk(2).startDate, endDate: mk(2).endDate, overruns: [] },
      { periodId: 'p1', startDate: mk(1).startDate, endDate: mk(1).endDate, overruns: [over('courses', '2000')] },
    ] };
    renderScreen('overruns');
    const cells = screen.getAllByTestId('overruns-cell');
    expect(cells[1].textContent).toContain('—');
  });
});

describe('Évolution', () => {
  const evo = (n: number, isActive = false) => ({
    ...mk(n, isActive),
    periodId: `p${n}`,
    realIncome: '100000',
    realExpenses: `-${n}0000`,
    realBankBalance: `${n}00000`,
    forecastBalance: '0',
  });

  it('sans période fermée : message', () => {
    state.periods = [mk(3, true)];
    state.evolution = [evo(3, true)];
    renderScreen('evolution');
    expect(screen.getByTestId('evolution-no-period')).toBeTruthy();
  });

  it("périodes fermées existantes mais réponse vide : un message, aucun graphique", () => {
    state.evolution = [];
    renderScreen('evolution');
    expect(screen.getByTestId('evolution-empty').textContent).toContain("pas disponibles");
    expect(screen.queryByTestId('chart-legend')).toBeNull();
    expect(screen.queryByTestId('evolution-no-period')).toBeNull();
  });

  it("légendes des trois graphiques ; le graphique revenus face aux dépenses n'existe plus", () => {
    state.evolution = [evo(1), evo(2), evo(3, true)];
    renderScreen('evolution');
    expect(screen.getAllByTestId('chart-legend')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Dépenses par période' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Solde en banque' })).toBeTruthy();
    expect(screen.queryByText(/Revenus vs Dépenses/i)).toBeNull();
  });

  it("une catégorie choisie dont le réel est positif (remboursement) : 0 € dépensé, pas la valeur absolue", () => {
    state.evolution = [evo(1), evo(2), evo(3, true)];
    state.chart = {
      categoryId: 'courses',
      points: [
        { periodId: 'p1', startDate: mk(1).startDate, endDate: mk(1).endDate, budget: '10000', real: '3462', overrun: '0' },
      ],
    };
    renderScreen('evolution');
    fireEvent.click(screen.getByRole('button', { name: 'Catégorie' }));
    const row = within(screen.getByTestId('category-evolution-table')).getAllByRole('row')[1];
    expect(row.textContent).not.toContain('34,62');
    expect(row.textContent).toMatch(/0,00.*100,00/);
  });

  it('une catégorie choisie : réel face au budget et marque « Dépassement » là où il y en a un', () => {
    state.evolution = [evo(1), evo(2), evo(3, true)];
    state.chart = {
      categoryId: 'courses',
      points: [
        { periodId: 'p1', startDate: mk(1).startDate, endDate: mk(1).endDate, budget: '10000', real: '-12000', overrun: '2000' },
        { periodId: 'p2', startDate: mk(2).startDate, endDate: mk(2).endDate, budget: '10000', real: '-7000', overrun: '0' },
      ],
    };
    renderScreen('evolution');
    fireEvent.click(screen.getByRole('button', { name: 'Catégorie' }));
    const table = screen.getByTestId('category-evolution-table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0].textContent).toMatch(/120,00.*100,00.*Dépassement/);
    expect(rows[1].textContent).not.toContain('Dépassement');
    expect(screen.getAllByTestId('overrun-mark')).toHaveLength(1);
    expect(screen.getAllByTestId('chart-legend')).toHaveLength(3);
  });
});

describe('écran Analyses : sous-titre', () => {
  const sub = () => screen.queryByTestId('analyses-subtitle')?.textContent;
  const renderIn = (locale: 'fr' | 'en') =>
    render(
      <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
        <AnalysesScreen />
      </NextIntlClientProvider>,
    );

  it('« Six périodes fermées, de mai à octobre » : les six périodes proposées, de la plus ancienne à la plus récente', () => {
    state.periods = [5, 6, 7, 8, 9, 10].map((n) => mk(n)).concat(mk(11, true));
    renderScreen();
    expect(sub()).toBe('Six périodes fermées, de mai à octobre');
  });

  it('plus de six périodes fermées : seules les six dernières sont décrites', () => {
    state.periods = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => mk(n)).concat(mk(11, true));
    renderScreen();
    expect(sub()).toBe('Six périodes fermées, de mars à août');
  });

  it('une seule période fermée : « Une période fermée, mars »', () => {
    state.periods = [mk(3), mk(11, true)];
    renderScreen();
    expect(sub()).toBe('Une période fermée, mars');
  });

  it('mois de début identiques : une phrase correcte, sans « de mars à mars »', () => {
    state.periods = [{ ...mk(3), id: 'a' }, { ...mk(3), id: 'b' }, mk(11, true)];
    renderScreen();
    expect(sub()).toBe('Deux périodes fermées, mars');
  });

  it('aucune période fermée : pas de sous-titre, le message existant suffit', () => {
    state.periods = [mk(11, true)];
    renderScreen();
    expect(sub()).toBeUndefined();
    expect(screen.getByTestId('breakdown-no-period')).toBeTruthy();
  });

  it('en anglais', () => {
    state.periods = [5, 6, 7, 8, 9, 10].map((n) => mk(n)).concat(mk(11, true));
    renderIn('en');
    expect(sub()).toBe('Six closed periods, from May to October');
    cleanup();
    state.periods = [mk(3), mk(11, true)];
    renderIn('en');
    expect(sub()).toBe('One closed period, March');
  });

  it('la légende de l\'écart parle d\'orange et plus de rouge, en fr comme en en', () => {
    state.periods = [mk(1), mk(2), mk(3, true)];
    state.comparison = { income: [], savings: [], transfers: [], expenses: [pt('courses', '-12000', '-15000', 25)] };
    renderScreen();
    const fr1 = screen.getAllByTestId('chart-legend').map((e) => e.textContent).join(' ');
    expect(fr1).toContain('orange si elle monte, bleu si elle baisse');
    expect(fr1).not.toMatch(/rouge/);
    expect(en.Reporting.analyses.breakdown.legend).toContain('orange if it goes up, blue if it goes down');
    expect(en.Reporting.analyses.breakdown.legend).not.toMatch(/\bred\b/);
  });
});
