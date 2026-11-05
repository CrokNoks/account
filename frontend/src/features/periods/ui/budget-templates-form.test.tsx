import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { BudgetTemplatesForm } from './budget-templates-form';

const save = vi.fn();

// Référence stable, comme react-query (sinon l'effet de chargement boucle).
const lines = [
  { categoryId: 'c1', name: 'Loyer', amount: '-80000', isProposal: false },
  { categoryId: 'c2', name: 'Abonnements', amount: '1250', isProposal: true },
];
vi.mock('../api/use-budget-templates', () => ({
  useBudgetTemplates: () => ({ data: lines, isLoading: false }),
}));
vi.mock('../api/use-save-budget-templates', () => ({
  useSaveBudgetTemplates: () => ({ mutate: save, isPending: false }),
}));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <BudgetTemplatesForm />
    </NextIntlClientProvider>,
  );
}

describe('BudgetTemplatesForm', () => {
  beforeEach(() => save.mockClear());

  it('shows every category and flags the unsaved proposal', () => {
    renderForm();

    expect(screen.getByText('Loyer')).toBeTruthy();
    expect(screen.getByText('Abonnements')).toBeTruthy();
    expect(screen.getAllByText(/non enregistrée/)).toHaveLength(1);
  });

  it('saves all lines at once, in cents', () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual({
      accountId: 'a1',
      items: [
        { categoryId: 'c1', amount: '-80000' },
        { categoryId: 'c2', amount: '1250' },
      ],
    });
  });
});
