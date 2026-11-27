import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { BudgetTemplatesForm } from './budget-templates-form';

const save = vi.fn();
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Référence stable, comme react-query (sinon l'effet de chargement boucle).
const lines = [
  { categoryId: 'c1', name: 'Loyer', amount: '-80000', isProposal: false },
  { categoryId: 'c2', name: 'Abonnements', amount: '1250', isProposal: true },
  { categoryId: 'c3', name: 'Virement CJ', amount: '-203248', isProposal: false, direction: 'outgoing' },
  { categoryId: 'c4', name: 'Salaire', amount: '0', isProposal: false, direction: 'incoming' },
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
  beforeEach(() => {
    save.mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it('shows every category and flags the unsaved proposal', () => {
    renderForm();

    expect(screen.getByText('Loyer')).toBeTruthy();
    expect(screen.getByText('Abonnements')).toBeTruthy();
    expect(screen.getAllByText(/non enregistrée/)).toHaveLength(1);
  });

  it('pre-fills the fields with the exact amount in French format, absolute value, like the Budgets screen', () => {
    renderForm();

    const values = screen.getAllByRole('textbox').map((i) => (i as HTMLInputElement).value);
    expect(values).toEqual(['800,00', '12,50', '2032,48', '']);
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
        { categoryId: 'c3', amount: '-203248' },
        { categoryId: 'c4', amount: '0' },
      ],
    });
  });

  it('saves a modified negative default as positive', () => {
    renderForm();
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '900,00' } });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect(save.mock.calls[0][0].items).toEqual([
      { categoryId: 'c1', amount: '90000' },
      { categoryId: 'c2', amount: '1250' },
      { categoryId: 'c3', amount: '-203248' },
      { categoryId: 'c4', amount: '0' },
    ]);
  });

  it('virement sortant : le défaut modifié garde son sens (2100,00 tapé : -2100,00), un montant négatif tapé est accepté', () => {
    renderForm();
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[2], { target: { value: '2100,00' } });
    fireEvent.change(inputs[3], { target: { value: '-50' } });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect(toast.error).not.toHaveBeenCalled();
    expect(save.mock.calls[0][0].items.slice(2)).toEqual([
      { categoryId: 'c3', amount: '-210000' },
      { categoryId: 'c4', amount: '-5000' },
    ]);
  });

  it('virement entrant sans défaut : un montant positif reste positif', () => {
    renderForm();
    fireEvent.change(screen.getAllByRole('textbox')[3], { target: { value: '500,00' } });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect(save.mock.calls[0][0].items[3]).toEqual({ categoryId: 'c4', amount: '50000' });
  });

  it('refuses a newly typed negative amount, as the Budgets screen does', () => {
    renderForm();
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect(save).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(fr.BudgetsScreen.negative_amount);
  });
});
