import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/shared/model/use-ui-store';
import { CommandMenu } from './command-menu';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// cmdk mesure et fait défiler la liste : jsdom n'a ni ResizeObserver ni scrollIntoView.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => useUiStore.setState({ isCommandMenuOpen: false }));

describe('palette de commandes', () => {
  it('s\'ouvre avec ⌘ + K et se referme au second appui', () => {
    render(<CommandMenu />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(useUiStore.getState().isCommandMenuOpen).toBe(true);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(useUiStore.getState().isCommandMenuOpen).toBe(false);
  });

  it('s\'ouvre quand le champ « Rechercher » de l\'en-tête demande l\'ouverture', () => {
    render(<CommandMenu />);
    expect(screen.queryByPlaceholderText('command.placeholder')).toBeNull();
    act(() => useUiStore.getState().setCommandMenuOpen(true));
    expect(screen.getByPlaceholderText('command.placeholder')).toBeTruthy();
  });
});
