import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './sidebar';

const push = vi.fn();
let pathname = '/fr';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock('@/shared/lib/supabase/supabase-browser', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

beforeEach(() => {
  push.mockClear();
  pathname = '/fr';
});

describe('sidebar : 6 entrées', () => {
  it('liste Aujourd\'hui, Opérations, Analyses, Budgets, Échéances, Réglages puis Déconnexion', () => {
    render(<Sidebar />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/', '/transactions', '/evolution', '/budgets', '/calendar', '/settings']);
    expect(links.map((l) => l.textContent)).toEqual([
      'todayF2', 'operationsF3', 'analysisF4', 'budgetsF5', 'due_datesF6', 'settings',
    ]);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe('logout');
  });

  it('pose les cibles de visite sur Budgets et Réglages seulement', () => {
    render(<Sidebar />);
    const tour = screen.getAllByRole('link').map((l) => l.getAttribute('data-tour'));
    expect(tour).toEqual([null, null, null, 'nav-budgets', null, 'nav-settings']);
  });
});

describe('sidebar : F2 à F6', () => {
  it.each([
    ['F2', '/'],
    ['F3', '/transactions'],
    ['F4', '/evolution'],
    ['F5', '/budgets'],
    ['F6', '/calendar'],
  ])('%s va sur %s', (key, href) => {
    render(<Sidebar />);
    fireEvent.keyDown(window, { key });
    expect(push).toHaveBeenCalledWith(href);
  });

  it("ignore F2 dans un champ texte et n'a pas de raccourci pour Réglages", () => {
    render(<><input aria-label="x" /><Sidebar /></>);
    screen.getByLabelText('x').focus();
    fireEvent.keyDown(window, { key: 'F2' });
    expect(push).not.toHaveBeenCalled();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(window, { key: 'F7' });
    expect(push).not.toHaveBeenCalled();
  });
});

describe('sidebar : entrée active par groupe', () => {
  it.each([
    ['/fr', '/'],
    ['/fr/flux', '/evolution'],
    ['/en/depassements', '/evolution'],
    ['/fr/cashflow', '/calendar'],
    ['/fr/transactions/import', '/transactions'],
    ['/fr/budgets/fixed', '/budgets'],
    ['/fr/categories', '/settings'],
    ['/en/recurring', '/settings'],
  ])('%s active %s', (path, active) => {
    pathname = path;
    render(<Sidebar />);
    const activeLinks = screen.getAllByRole('link').filter((l) => l.className.includes('bg-primary'));
    expect(activeLinks.map((l) => l.getAttribute('href'))).toEqual([active]);
  });
});
