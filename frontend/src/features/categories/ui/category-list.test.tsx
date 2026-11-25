import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { CategoryList } from './category-list';

const { updateMutate, categories } = vi.hoisted(() => ({
  updateMutate: vi.fn(),
  categories: [
    { id: 'c1', name: 'Courses', color: '#000000', type: 'expense', accountId: 'a1' },
    { id: 'c2', name: 'Salaire', color: '#00ff00', type: 'income', accountId: 'a1', isPeriodTrigger: true },
  ],
}));
vi.mock('../api/use-categories', () => ({
  useCategories: () => ({ data: categories, isLoading: false }),
}));
vi.mock('../api/use-update-category', () => ({
  useUpdateCategory: () => ({ mutate: updateMutate, isPending: false }),
}));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));

function renderList() {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <CategoryList />
    </NextIntlClientProvider>,
  );
}

describe('CategoryList', () => {
  // Le montant affiché était écrit en dur à 0, reste du plafond de catégorie.
  it('shows no amount on a category card', () => {
    renderList();

    expect(screen.getByText('Courses')).toBeTruthy();
    expect(screen.queryByText(/€/)).toBeNull();
  });

  // Le plafond de catégorie n'existe plus : le budget est celui de la période.
  it('edits a category without a budget field', () => {
    renderList();

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getByText('Nom')).toBeTruthy();
    expect(screen.getByText('Couleur')).toBeTruthy();
    expect(screen.queryByText(/budget/i)).toBeNull();
  });

  it('links the labels of the edit drawer to their fields', () => {
    renderList();

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getByLabelText(fr.Categories.fields.name)).toHaveValue('Courses');
    expect(screen.getByLabelText(fr.Categories.fields.type)).toHaveTextContent(fr.Categories.types.expense);
    expect(screen.getByLabelText(fr.Categories.fields.color)).toHaveAttribute('type', 'color');
  });

  describe('period trigger setting', () => {
    beforeEach(() => updateMutate.mockClear());
    const open = (name: string) => {
      const card = screen.getByText(name).closest('[data-slot="card"]') as HTMLElement;
      fireEvent.click(card.querySelector('button') as HTMLElement);
    };

    it('marks only the trigger category on the list', () => {
      renderList();

      expect(screen.getAllByText(fr.Categories.fields.period_trigger_badge)).toHaveLength(1);
    });

    it('offers the setting unchecked on a normal category and sends the mark on save', () => {
      renderList();
      open('Courses');

      const box = screen.getByRole('checkbox', { name: fr.Categories.fields.period_trigger });
      expect(box).toHaveAttribute('aria-checked', 'false');
      fireEvent.click(box);
      fireEvent.click(screen.getByRole('button', { name: fr.Common.save }));

      expect(updateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c1', data: expect.objectContaining({ isPeriodTrigger: true }) }),
        expect.anything(),
      );
    });

    it('shows the mark checked and removes it on save', () => {
      renderList();
      open('Salaire');

      const box = screen.getByRole('checkbox', { name: fr.Categories.fields.period_trigger });
      expect(box).toHaveAttribute('aria-checked', 'true');
      fireEvent.click(box);
      fireEvent.click(screen.getByRole('button', { name: fr.Common.save }));

      expect(updateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c2', data: expect.objectContaining({ isPeriodTrigger: false }) }),
        expect.anything(),
      );
    });

    it.each(['Courses', 'Salaire'])(
      'does not send the mark when it did not change (%s: rename works without the migration)',
      (name) => {
        renderList();
        open(name);
        fireEvent.click(screen.getByRole('button', { name: fr.Common.save }));

        expect(updateMutate.mock.calls[0][0].data).not.toHaveProperty('isPeriodTrigger');
      },
    );

    it('explains the effect in english too', async () => {
      const en = (await import('../../../../messages/en.json')).default;
      render(
        <NextIntlClientProvider locale="en" messages={en}>
          <CategoryList />
        </NextIntlClientProvider>,
      );
      open('Courses');

      expect(screen.getByText(en.Categories.fields.period_trigger_hint)).toBeTruthy();
    });
  });
});
