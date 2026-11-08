import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/shared/model/use-ui-store';
import { Header } from './header';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'fr' }));
vi.mock('next/navigation', () => ({ usePathname: () => '/fr' }));
vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['fr', 'en'] },
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@/features/accounts/ui/account-selector', () => ({
  AccountSelector: () => <div data-testid="account-selector" />,
}));
vi.mock('./theme-toggle', () => ({ ThemeToggle: () => <button type="button">theme</button> }));

beforeEach(() => useUiStore.setState({ isCommandMenuOpen: false }));

describe('en-tête : champ « Rechercher ⌘K »', () => {
  it('est visible sur grand écran seulement, avec le raccourci', () => {
    render(<Header />);
    const field = screen.getByTestId('search-field');
    expect(field.textContent).toContain('search');
    expect(field.textContent).toContain('⌘K');
    expect(field.className).toContain('hidden lg:flex');
  });

  it('un clic ouvre la palette de commandes (le même état que ⌘/Ctrl + K)', () => {
    render(<Header />);
    fireEvent.click(screen.getByTestId('search-field'));
    expect(useUiStore.getState().isCommandMenuOpen).toBe(true);
  });
});

describe('en-tête : sélecteur de compte', () => {
  it('reste dans l\'en-tête sur mobile et disparaît sur grand écran (il est dans le menu latéral)', () => {
    render(<Header />);
    expect(screen.getByTestId('account-selector').parentElement!.className).toContain('lg:hidden');
  });
});
