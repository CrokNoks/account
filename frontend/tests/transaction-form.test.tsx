/**
 * Tests de non-régression — transaction-form.tsx
 *
 * Bug 1: Enter doit déclencher onAddAnother (et non onSubmit)
 * Bug 2: TransactionForm se réinitialise quand sa key change (via formKey dans le drawer)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks — dépendances externes
// ---------------------------------------------------------------------------

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      Transactions: {
        'fields.date': 'Date',
        'fields.description': 'Description',
        'fields.category': 'Category',
        'fields.amount': 'Amount',
        'fields.pending': 'Pending / Pre-auth',
        save_another: 'Save & Add Another',
        expense_hint: 'Use negative value for expenses',
        new_transaction_title: 'New Transaction',
      },
      Common: {
        loading: 'Loading...',
        save: 'Save',
      },
    };
    return dict[ns]?.[key] ?? key;
  },
}));

vi.mock('@/features/accounts/api/use-accounts', () => ({
  useAccounts: () => ({ data: [] }),
}));

vi.mock('@/features/transactions/api/use-predict-category', () => ({
  usePredictCategory: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/features/savings/api/use-savings-goals', () => ({
  useSavingsGoals: () => ({ data: [] }),
}));

vi.mock('@/features/categories/ui/category-selector', () => ({
  CategorySelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      data-testid="category-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="category"
    />
  ),
}));

vi.mock('@/features/tags/ui/tag-selector', () => ({
  TagSelector: () => <div data-testid="tag-selector" />,
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import du composant après les mocks
// ---------------------------------------------------------------------------
import { TransactionForm } from '@/features/transactions/ui/transaction-form';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderForm(overrides: Partial<React.ComponentProps<typeof TransactionForm>> = {}) {
  const defaultProps: React.ComponentProps<typeof TransactionForm> = {
    accountId: 'account-1',
    isPending: false,
    submitLabel: 'Save',
    onSubmit: vi.fn(),
    ...overrides,
  };
  return { ...render(<TransactionForm {...defaultProps} />), props: defaultProps };
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  const descriptionInput = screen.getByPlaceholderText(/rent, groceries/i);
  const amountInput = screen.getByPlaceholderText('0.00');

  await user.clear(descriptionInput);
  await user.type(descriptionInput, 'Test transaction');
  await user.clear(amountInput);
  await user.type(amountInput, '42.00');
}

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

describe('Bug 1 — Enter déclenche onAddAnother et non onSubmit', () => {
  it('appuyer sur Enter dans le champ description appelle onAddAnother quand il est fourni', async () => {
    const onAddAnother = vi.fn();
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    renderForm({ onAddAnother, onSubmit });
    await fillRequiredFields(user);

    const descriptionInput = screen.getByPlaceholderText(/rent, groceries/i);
    await user.click(descriptionInput);
    await user.keyboard('{Enter}');

    expect(onAddAnother).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('appuyer sur Enter dans le champ montant appelle onAddAnother quand il est fourni', async () => {
    const onAddAnother = vi.fn();
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    renderForm({ onAddAnother, onSubmit });
    await fillRequiredFields(user);

    const amountInput = screen.getByPlaceholderText('0.00');
    await user.click(amountInput);
    await user.keyboard('{Enter}');

    expect(onAddAnother).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Shift+Enter appelle onSubmit (fermer le drawer) et non onAddAnother', async () => {
    const onAddAnother = vi.fn();
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    renderForm({ onAddAnother, onSubmit });
    await fillRequiredFields(user);

    const descriptionInput = screen.getByPlaceholderText(/rent, groceries/i);
    await user.click(descriptionInput);
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onAddAnother).not.toHaveBeenCalled();
  });

  it('Enter ne déclenche pas onAddAnother si le formulaire est invalide (champs vides)', async () => {
    const onAddAnother = vi.fn();
    const user = userEvent.setup();

    renderForm({ onAddAnother });

    const descriptionInput = screen.getByPlaceholderText(/rent, groceries/i);
    await user.click(descriptionInput);
    await user.keyboard('{Enter}');

    expect(onAddAnother).not.toHaveBeenCalled();
  });

  it('Enter sans onAddAnother déclenche la soumission native du formulaire', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    renderForm({ onSubmit }); // pas de onAddAnother

    const descriptionInput = screen.getByPlaceholderText(/rent, groceries/i);
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Test');
    const amountInput = screen.getByPlaceholderText('0.00');
    await user.clear(amountInput);
    await user.type(amountInput, '10');
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('onAddAnother reçoit les valeurs courantes du formulaire au moment de la pression Enter', async () => {
    const onAddAnother = vi.fn();
    const user = userEvent.setup();

    renderForm({ onAddAnother });

    const descriptionInput = screen.getByPlaceholderText(/rent, groceries/i);
    const amountInput = screen.getByPlaceholderText('0.00');

    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Supermarché');
    await user.clear(amountInput);
    await user.type(amountInput, '-25.50');

    await user.click(descriptionInput);
    await user.keyboard('{Enter}');

    expect(onAddAnother).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Supermarché',
        amount: '-25.5', // type=number normalise -25.50 → -25.5
      })
    );
  });
});

describe('Bug 2 — Réinitialisation du formulaire via changement de key (formKey dans le drawer)', () => {
  it('les champs sont vides quand le composant est monté sans initialValues', () => {
    renderForm();

    const descriptionInput = screen.getByPlaceholderText(/rent, groceries/i) as HTMLInputElement;
    const amountInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;

    expect(descriptionInput.value).toBe('');
    expect(amountInput.value).toBe('');
  });

  it('les valeurs initiales sont bien hydratées depuis initialValues', () => {
    renderForm({
      initialValues: {
        description: 'Loyer',
        amount: '-1200',
      },
    });

    const descriptionInput = screen.getByPlaceholderText(/rent, groceries/i) as HTMLInputElement;
    const amountInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;

    expect(descriptionInput.value).toBe('Loyer');
    expect(amountInput.value).toBe('-1200');
  });

  it('re-monter le composant avec une nouvelle key réinitialise les champs même si initialValues est {}', () => {
    // Simule le comportement du drawer : formKey incrémenté → key "standard-1" au lieu de "standard-0"
    const { rerender } = render(
      <TransactionForm
        key="standard-0"
        accountId="account-1"
        isPending={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
        initialValues={{ description: 'Café', amount: '-3' }}
      />
    );

    const descriptionInput = screen.getByPlaceholderText(/rent, groceries/i) as HTMLInputElement;
    expect(descriptionInput.value).toBe('Café');

    // Le drawer incrémente formKey : key passe à "standard-1"
    rerender(
      <TransactionForm
        key="standard-1"
        accountId="account-1"
        isPending={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
        initialValues={{}}
      />
    );

    // React re-monte le composant → useState réinitialisé
    const freshDescription = screen.getByPlaceholderText(/rent, groceries/i) as HTMLInputElement;
    expect(freshDescription.value).toBe('');
  });

  it('sans changement de key, les états internes NE sont PAS réinitialisés (comportement React attendu)', () => {
    // Ce test documente le comportement bugué PRE-FIX et confirme que le fix (formKey) est nécessaire
    const { rerender } = render(
      <TransactionForm
        key="standard-0"
        accountId="account-1"
        isPending={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
        initialValues={{ description: 'Café', amount: '-3' }}
      />
    );

    const descriptionInput = screen.getByPlaceholderText(/rent, groceries/i) as HTMLInputElement;
    expect(descriptionInput.value).toBe('Café');

    // key inchangée : React ne re-monte pas, useState conserve ses valeurs
    rerender(
      <TransactionForm
        key="standard-0"
        accountId="account-1"
        isPending={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
        initialValues={{}}
      />
    );

    // Valeurs conservées → c'est exactement le bug décrit dans le Bug Report (avant le fix de formKey)
    const sameInput = screen.getByPlaceholderText(/rent, groceries/i) as HTMLInputElement;
    expect(sameInput.value).toBe('Café');
  });

  it('le changement de mode (standard→transfer) réinitialise le formulaire via la key composite', () => {
    // La key du drawer est `${mode}-${formKey}` — changer de mode doit re-monter le composant
    const { rerender } = render(
      <TransactionForm
        key="standard-0"
        accountId="account-1"
        isPending={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
        mode="standard"
        initialValues={{ description: 'Courses', amount: '-50' }}
      />
    );

    const descriptionBefore = screen.getByPlaceholderText(/rent, groceries/i) as HTMLInputElement;
    expect(descriptionBefore.value).toBe('Courses');

    rerender(
      <TransactionForm
        key="transfer-0"
        accountId="account-1"
        isPending={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
        mode="transfer"
        initialValues={{}}
      />
    );

    // mode transfer affiche un placeholder différent
    const transferInput = screen.getByPlaceholderText(/virement épargne/i) as HTMLInputElement;
    expect(transferInput.value).toBe('');
  });
});

describe('TransactionForm — comportements généraux du formulaire', () => {
  it('le bouton "Save & Add Another" est visible quand onAddAnother est fourni', () => {
    renderForm({ onAddAnother: vi.fn() });
    expect(screen.getByText('Save & Add Another')).toBeInTheDocument();
  });

  it('le bouton "Save & Add Another" est absent quand onAddAnother n\'est pas fourni', () => {
    renderForm();
    expect(screen.queryByText('Save & Add Another')).not.toBeInTheDocument();
  });

  it('les boutons sont désactivés quand isPending est true', () => {
    renderForm({ isPending: true, onAddAnother: vi.fn() });
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('les boutons sont désactivés quand le formulaire est invalide (champs vides)', () => {
    renderForm({ onAddAnother: vi.fn() });

    const addAnotherBtn = screen.getByText('Save & Add Another');
    const saveBtn = screen.getByText('Save');

    expect(addAnotherBtn.closest('button')).toBeDisabled();
    expect(saveBtn.closest('button')).toBeDisabled();
  });

  it('les boutons sont activés quand les champs requis sont remplis', async () => {
    const user = userEvent.setup();
    renderForm({ onAddAnother: vi.fn() });
    await fillRequiredFields(user);

    const addAnotherBtn = screen.getByText('Save & Add Another');
    const saveBtn = screen.getByText('Save');

    expect(addAnotherBtn.closest('button')).not.toBeDisabled();
    expect(saveBtn.closest('button')).not.toBeDisabled();
  });

  it('cliquer sur "Save & Add Another" appelle onAddAnother avec les valeurs du formulaire', async () => {
    const onAddAnother = vi.fn();
    const user = userEvent.setup();

    renderForm({ onAddAnother });
    await fillRequiredFields(user);

    await user.click(screen.getByText('Save & Add Another'));

    expect(onAddAnother).toHaveBeenCalledOnce();
    expect(onAddAnother).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Test transaction',
        amount: '42', // type=number normalise 42.00 → 42
      })
    );
  });

  it('cliquer sur le bouton Save appelle onSubmit avec les valeurs du formulaire', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    renderForm({ onSubmit });
    await fillRequiredFields(user);

    await user.click(screen.getByText('Save'));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Test transaction',
        amount: '42', // type=number normalise 42.00 → 42
      })
    );
  });
});
