import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionForm } from './transaction-form';

let desktop = false;

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/shared/lib/use-is-desktop', () => ({ useIsDesktop: () => desktop }));
vi.mock('@/features/tags/ui/tag-selector', () => ({ TagSelector: () => <div data-testid="tag-selector" /> }));
vi.mock('@/features/categories/ui/category-selector', () => ({
  CategorySelector: () => <div data-testid="category" />,
}));
vi.mock('@/features/accounts/api/use-accounts', () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock('../api/use-predict-category', () => ({ usePredictCategory: () => ({ mutate: vi.fn() }) }));

const renderForm = (props: Partial<React.ComponentProps<typeof TransactionForm>> = {}) =>
  render(
    <TransactionForm accountId="a1" onSubmit={vi.fn()} onAddAnother={vi.fn()} isPending={false} submitLabel="ok" {...props} />,
  );
const amount = () => screen.getByPlaceholderText('0.00') as HTMLInputElement;
const fill = (value = '12,50') => {
  fireEvent.change(screen.getByPlaceholderText('form.description_placeholder_standard'), { target: { value: 'Courses' } });
  fireEvent.change(amount(), { target: { value } });
};

beforeEach(() => {
  desktop = false;
});

describe('saisie mobile : sens et montant', () => {
  it('Dépense est choisi par défaut ; Revenu change le sens envoyé', () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });
    expect(screen.getByRole('button', { name: 'direction_expense' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'direction_income' }).getAttribute('aria-pressed')).toBe('false');
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'direction_income' }));
    expect(screen.getByRole('button', { name: 'direction_income' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^ok/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: '12,50', direction: 'income' }));
  });

  it('le sens par défaut envoyé est expense', () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });
    fill();
    fireEvent.click(screen.getByRole('button', { name: /^ok/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ direction: 'expense' }));
  });

  it('le montant ouvre le clavier décimal natif, sans motif ni indication de signe négatif', () => {
    renderForm();
    expect(amount().getAttribute('inputmode')).toBe('decimal');
    expect(amount().type).toBe('text');
    expect(amount().getAttribute('pattern')).toBeNull();
    expect(screen.queryByText('expense_hint')).toBeNull();
  });

  it('le curseur est sur Montant', () => {
    renderForm();
    expect(document.activeElement).toBe(amount());
  });

  it('en virement, le sens n\'est pas proposé', () => {
    renderForm({ mode: 'transfer', onModeChange: vi.fn() });
    expect(screen.queryByRole('button', { name: 'direction_expense' })).toBeNull();
  });

  it('remise à zéro (nouvelle clé) : Dépense, montant vide, Plus d\'options replié', () => {
    const { rerender } = renderForm({ onModeChange: vi.fn() });
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'direction_income' }));
    fireEvent.click(screen.getByRole('button', { name: /more_options/ }));
    rerender(
      <TransactionForm key="2" accountId="a1" onSubmit={vi.fn()} onAddAnother={vi.fn()} isPending={false} submitLabel="ok" onModeChange={vi.fn()} />,
    );
    expect(amount().value).toBe('');
    expect(screen.getByRole('button', { name: 'direction_expense' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /more_options/ }).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(amount());
  });
});

describe('saisie mobile : ordre', () => {
  it('Montant, Libellé, Catégorie, Date, puis « Plus d\'options »', () => {
    const { container } = renderForm({ onModeChange: vi.fn() });
    const order = [
      amount(),
      screen.getByPlaceholderText('form.description_placeholder_standard'),
      screen.getByTestId('category'),
      container.querySelector('input[type="date"]')!,
      screen.getByTestId('more-options'),
      screen.getByRole('button', { name: /^ok/ }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe('touche Entrée', () => {
  it('mobile : n\'envoie rien (ni onAddAnother ni onSubmit)', () => {
    const onSubmit = vi.fn();
    const onAddAnother = vi.fn();
    renderForm({ onSubmit, onAddAnother });
    fill();
    expect(fireEvent.keyDown(amount(), { key: 'Enter' })).toBe(false); // preventDefault
    expect(onAddAnother).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('bureau : Entrée envoie ; pendant l\'envoi, plus rien', () => {
    desktop = true;
    const onAddAnother = vi.fn();
    const { rerender } = renderForm({ onAddAnother });
    fill('-12,50');
    fireEvent.keyDown(amount(), { key: 'Enter' });
    expect(onAddAnother).toHaveBeenCalledTimes(1);

    rerender(<TransactionForm accountId="a1" onSubmit={vi.fn()} onAddAnother={onAddAnother} isPending submitLabel="ok" />);
    fireEvent.keyDown(amount(), { key: 'Enter' });
    expect(onAddAnother).toHaveBeenCalledTimes(1);
  });

  it('bureau : ni sens ni clavier décimal (signe tapé, inchangé)', () => {
    desktop = true;
    renderForm();
    expect(screen.queryByRole('button', { name: 'direction_expense' })).toBeNull();
    expect(amount().getAttribute('inputmode')).toBe('text');
    expect(screen.getByText('expense_hint')).toBeTruthy();
  });
});
