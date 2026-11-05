import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { CategoryOverrunsChart } from './category-overruns-chart';

const chartHook = vi.fn<(...args: unknown[]) => { data: undefined; isLoading: boolean }>(() => ({ data: undefined, isLoading: false }));
let periods: unknown[] = [];

vi.mock('@/features/accounts/model/use-account-store', () => ({ useAccountStore: () => ({ activeAccountId: 'acc-1' }) }));
vi.mock('@/features/categories/api/use-categories', () => ({
  useCategories: () => ({
    data: [
      { id: 'e', name: 'Courses', type: 'expense' },
      { id: 's', name: 'Livret', type: 'savings' },
      { id: 'i', name: 'Salaire', type: 'income' },
      { id: 't', name: 'Virement', type: 'transfer' },
    ],
  }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({ usePeriods: () => ({ data: periods }) }));
vi.mock('../api/use-overruns', () => ({ useCategoryOverrunsChart: (...a: unknown[]) => chartHook(...a) }));

const mk = (n: number, isActive = false) => ({
  id: `p${n}`,
  startDate: `2026-${String(n).padStart(2, '0')}-01T00:00:00.000Z`,
  endDate: `2026-${String(n).padStart(2, '0')}-28T00:00:00.000Z`,
  isActive,
});
const show = () => render(<NextIntlClientProvider locale="fr" messages={fr}><CategoryOverrunsChart /></NextIntlClientProvider>);

const user = userEvent.setup();
const choose = async (trigger: string, option: string) => {
  await user.click(screen.getByLabelText(trigger));
  await user.click(within(await screen.findByRole('listbox')).getByText(option));
};
const optionsOf = async (trigger: string) => {
  await user.click(screen.getByLabelText(trigger));
  const texts = within(await screen.findByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
  await user.keyboard('{Escape}');
  return texts;
};

describe('CategoryOverrunsChart', () => {
  it('shows a message when there is no closed period', async () => {
    periods = [mk(1, true)];
    show();
    expect(screen.getByTestId('overruns-chart-no-period')).toBeTruthy();
  });

  it('only offers expense and savings categories, none preselected', async () => {
    periods = [mk(1), mk(2)];
    show();
    expect(screen.getByLabelText('Catégorie').textContent).toContain('Choisir une catégorie');
    expect(await optionsOf('Catégorie')).toEqual(['Courses', 'Livret']);
    expect(chartHook.mock.calls.at(-1)).toEqual(['acc-1', null, 'p1', 'p2']);
  });

  it('defaults P2 to the last closed period and P1 six ranks before', async () => {
    periods = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => mk(n));
    show();
    expect(screen.getByLabelText('Période de début').textContent).toMatch(/mars/);
    expect(screen.getByLabelText('Période de fin').textContent).toMatch(/sept/);
  });

  it('refuses P1 after P2 and does not query', async () => {
    periods = [mk(1), mk(2), mk(3)];
    show();
    await choose('Catégorie', 'Courses');
    await choose('Période de début', 'mars 26');
    await choose('Période de fin', 'janv. 26');
    expect(screen.getByRole('alert').textContent).toContain('antérieure');
    expect(chartHook.mock.calls.at(-1)).toEqual(['acc-1', 'e', null, null]);
    expect(screen.getByLabelText('Période de début').textContent).toMatch(/mars/);
  });
});
