import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MoreMenu } from './more-menu';

const push = vi.fn();
const signOut = vi.fn().mockResolvedValue({});
let pathname = '/fr';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock('@/shared/lib/supabase/supabase-browser', () => ({ createClient: () => ({ auth: { signOut } }) }));

beforeEach(() => {
  push.mockClear();
  signOut.mockClear();
  pathname = '/fr';
});

const open = () => fireEvent.click(screen.getByRole('button', { name: 'more' }));

describe('« Plus » de la barre du bas', () => {
  it('est fermé par défaut, cible de visite nav-more', () => {
    render(<MoreMenu />);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'more' }).getAttribute('data-tour')).toBe('nav-more');
  });

  it('ouvre trois liens (Budgets, Échéances, Réglages) puis Déconnexion', () => {
    render(<MoreMenu />);
    open();
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['budgets', 'due_dates', 'settings', 'logout']);
    expect(screen.getAllByRole('menuitem').slice(0, 3).map((l) => l.getAttribute('href'))).toEqual(['/budgets', '/echeances', '/settings']);
  });

  it('se ferme au choix d\'un lien, à Échap et au clic à côté', () => {
    render(<MoreMenu />);
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'due_dates' }));
    expect(screen.queryByRole('menu')).toBeNull();
    open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    open();
    fireEvent.click(screen.getByTestId('more-backdrop'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Déconnexion déconnecte, va sur /login et ferme', async () => {
    render(<MoreMenu />);
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'logout' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it.each(['/fr/budgets', '/fr/budgets/fixed', '/en/echeances', '/fr/settings', '/fr/accounts', '/fr/categories', '/fr/tags', '/fr/smart-rules', '/fr/recurring'])(
    '%s allume « Plus »',
    (path) => {
      pathname = path;
      render(<MoreMenu />);
      expect(screen.getByRole('button', { name: 'more' }).className).toContain('text-primary');
    },
  );

  it.each(['/fr', '/fr/transactions', '/fr/analyses'])('%s n\'allume pas « Plus » et Déconnexion n\'est jamais allumée', (path) => {
    pathname = path;
    render(<MoreMenu />);
    expect(screen.getByRole('button', { name: 'more' }).className).not.toContain('text-primary');
    open();
    expect(screen.getByRole('menuitem', { name: 'logout' }).className).not.toContain('bg-primary');
  });

  it('chaque cible fait 44 px au moins', () => {
    render(<MoreMenu />);
    open();
    for (const el of [screen.getByRole('button', { name: 'more' }), ...screen.getAllByRole('menuitem')]) {
      expect(el.className, el.textContent ?? '').toMatch(/min-h-11/);
    }
  });
});
