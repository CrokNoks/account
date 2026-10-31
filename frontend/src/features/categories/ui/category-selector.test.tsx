import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { CategorySelector } from './category-selector';

const categories = [
  { id: 'c-fetes', name: 'Fêtes', color: '#111111' },
  { id: 'c-elec', name: 'Électricité', color: '#222222' },
  { id: 'c-divers', name: 'Divers', color: '#333333' },
  { id: 'c-epargne', name: 'Épargne', color: '#444444' },
  { id: 'c-zen', name: 'zen', color: '#555555' },
  // same name as another category: selection must go by id
  { id: 'c-divers-2', name: 'Divers', color: '#666666' },
];

let currentCategories = categories;
vi.mock('@/features/categories/api/use-categories', () => ({
  useCategories: () => ({ data: currentCategories, isLoading: false }),
}));

beforeAll(() => {
  // cmdk / base-ui need these in jsdom
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

function setup(value = '') {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <CategorySelector accountId="acc-1" value={value} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox'));
}

function optionNames() {
  return screen.getAllByRole('option').map((o) => o.textContent);
}

describe('CategorySelector', () => {
  it('sorts alphabetically, ignoring accents and case, with "none" first', async () => {
    const { user } = setup();
    await open(user);
    expect(optionNames()).toEqual([
      'Sans catégorie',
      'Divers',
      'Divers',
      'Électricité',
      'Épargne',
      'Fêtes',
      'zen',
    ]);
  });

  it('filters by substring, ignoring accents and case, and hides "none"', async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByPlaceholderText(fr.Categories.selector.search_placeholder), 'ELE');
    expect(optionNames()).toEqual(['Électricité']);
  });

  it('shows the empty message when nothing matches', async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByPlaceholderText(fr.Categories.selector.search_placeholder), 'xyz');
    expect(screen.getByText('Aucune catégorie trouvée')).toBeInTheDocument();
  });

  it('saves the clicked category after a search, not another one', async () => {
    const { user, onChange } = setup();
    await open(user);
    await user.type(screen.getByPlaceholderText(fr.Categories.selector.search_placeholder), 'fet');
    await user.click(screen.getByRole('option', { name: 'Fêtes' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('c-fetes');
  });

  it('saves the clicked category in the sorted list (id, not position)', async () => {
    const { user, onChange } = setup();
    await open(user);
    await user.click(screen.getByRole('option', { name: 'Épargne' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('c-epargne');
  });

  it('distinguishes two categories with the same name', async () => {
    const { user, onChange } = setup();
    await open(user);
    await user.click(within(screen.getByRole('listbox')).getAllByRole('option', { name: 'Divers' })[1]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(['c-divers', 'c-divers-2']).toContain(onChange.mock.calls[0][0]);
  });

  it('saves an empty value for "none"', async () => {
    const { user, onChange } = setup('c-zen');
    await open(user);
    await user.click(screen.getByRole('option', { name: 'Sans catégorie' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
  });

  it('keeps the chosen category in the trigger even if the search hides it', async () => {
    const { user } = setup('c-zen');
    await open(user);
    await user.type(screen.getByPlaceholderText(fr.Categories.selector.search_placeholder), 'fet');
    expect(within(screen.getAllByRole('combobox')[0]).getByText('zen')).toBeInTheDocument();
  });

  it('clears the search when reopened', async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByPlaceholderText(fr.Categories.selector.search_placeholder), 'fet');
    await user.keyboard('{Escape}');
    await open(user);
    expect(screen.getByPlaceholderText(fr.Categories.selector.search_placeholder)).toHaveValue('');
  });

  it('sorts once per categories list, whatever the number of selectors', () => {
    currentCategories = categories.map((c) => ({ ...c }));
    const spy = vi.spyOn(String.prototype, 'localeCompare');
    const renderMany = (n: number) =>
      render(
        <NextIntlClientProvider locale="fr" messages={fr}>
          {Array.from({ length: n }, (_, i) => (
            <CategorySelector key={i} accountId="acc-1" value="" onChange={() => {}} />
          ))}
        </NextIntlClientProvider>,
      );
    const first = renderMany(1);
    const callsForOne = spy.mock.calls.length;
    expect(callsForOne).toBeGreaterThan(0);
    first.unmount();
    renderMany(5);
    expect(spy.mock.calls.length).toBe(callsForOne);

    // a new list (new reference) is sorted again
    currentCategories = categories.map((c) => ({ ...c }));
    renderMany(1);
    expect(spy.mock.calls.length).toBe(callsForOne * 2);
    spy.mockRestore();
    currentCategories = categories;
  });
});
