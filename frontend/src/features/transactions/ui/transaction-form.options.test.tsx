import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { TransactionForm } from './transaction-form';

const predict = vi.hoisted(() => ({ mutate: vi.fn() }));
let desktop = false;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/shared/lib/use-is-desktop', () => ({ useIsDesktop: () => desktop }));
vi.mock('@/features/tags/ui/tag-selector', () => ({ TagSelector: () => <div data-testid="tag-selector" /> }));
vi.mock('@/features/categories/ui/category-selector', () => ({
  CategorySelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="category" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('@/features/accounts/api/use-accounts', () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock('../api/use-predict-category', () => ({ usePredictCategory: () => ({ mutate: predict.mutate }) }));

const renderForm = (props: Partial<React.ComponentProps<typeof TransactionForm>> = {}) =>
  render(<TransactionForm accountId="a1" onSubmit={vi.fn()} isPending={false} submitLabel="ok" {...props} />);

const type = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText('form.description_placeholder_standard'), { target: { value } });

beforeEach(() => {
  desktop = false;
  predict.mutate.mockReset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('« Plus d\'options » (mobile)', () => {
  it('replié : ni étiquettes, ni « en attente », ni virement', () => {
    renderForm({ onModeChange: vi.fn() });
    expect(screen.getByRole('button', { name: /more_options/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('tag-selector')).toBeNull();
    expect(screen.queryByLabelText('fields.pending')).toBeNull();
    expect(screen.queryByLabelText('mode_transfer')).toBeNull();
  });

  it('déplié : étiquettes, en attente et virement ; le virement change de mode', () => {
    const onModeChange = vi.fn();
    renderForm({ onModeChange });
    fireEvent.click(screen.getByRole('button', { name: /more_options/ }));
    expect(screen.getByTestId('tag-selector')).toBeTruthy();
    expect(screen.getByLabelText('fields.pending')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('mode_transfer'));
    expect(onModeChange).toHaveBeenCalledWith('transfer');
  });

  it('en mode virement, le bloc s\'ouvre sur le choix de virement seul', () => {
    renderForm({ mode: 'transfer', onModeChange: vi.fn() });
    expect(screen.getByLabelText('mode_transfer')).toBeTruthy();
    expect(screen.queryByTestId('tag-selector')).toBeNull();
  });

  it('chaque cible du bloc fait 44 px au moins', () => {
    renderForm({ onModeChange: vi.fn() });
    expect(screen.getByRole('button', { name: /more_options/ }).className).toContain('min-h-11');
  });

  it('bureau : étiquettes et « en attente » restent dans le formulaire, sans bloc', () => {
    desktop = true;
    renderForm({ onModeChange: vi.fn() });
    expect(screen.queryByTestId('more-options')).toBeNull();
    expect(screen.getByTestId('tag-selector')).toBeTruthy();
    expect(screen.getByLabelText('fields.pending')).toBeTruthy();
  });

  it('les clés existent en français et en anglais', () => {
    expect(fr.Transactions.more_options).toBe("Plus d'options");
    expect(en.Transactions.more_options).toBe('More options');
  });
});

describe('catégorie suggérée', () => {
  const answer = (categoryId: string | null) =>
    predict.mutate.mockImplementation((_v, o) => o.onSuccess({ categoryId }));

  it('présélectionne la catégorie prédite au bout de 3 caractères, avec la mention', () => {
    answer('cat-1');
    renderForm();
    type('ab');
    act(() => { vi.advanceTimersByTime(700); });
    expect(predict.mutate).not.toHaveBeenCalled();
    type('abc');
    act(() => { vi.advanceTimersByTime(700); });
    expect(predict.mutate).toHaveBeenCalledWith({ accountId: 'a1', description: 'abc' }, expect.anything());
    expect((screen.getByTestId('category') as HTMLInputElement).value).toBe('cat-1');
    expect(screen.getByTestId('suggested-category').textContent).toBe('suggested_category');
  });

  it('ne remplace jamais un choix manuel arrivé avant la réponse', () => {
    let resolve: (id: string) => void = () => {};
    predict.mutate.mockImplementation((_v, o) => { resolve = (id) => o.onSuccess({ categoryId: id }); });
    renderForm();
    type('loyer');
    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.change(screen.getByTestId('category'), { target: { value: 'manual' } });
    act(() => resolve('suggested'));
    expect((screen.getByTestId('category') as HTMLInputElement).value).toBe('manual');
    expect(screen.queryByTestId('suggested-category')).toBeNull();
  });

  it('ne demande rien si une catégorie est déjà choisie', () => {
    renderForm({ initialValues: { categoryId: 'chosen' } });
    type('loyer');
    act(() => { vi.advanceTimersByTime(700); });
    expect(predict.mutate).not.toHaveBeenCalled();
  });

  it('retire la mention quand l\'utilisateur choisit lui-même', () => {
    answer('cat-1');
    renderForm();
    type('loyer');
    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.change(screen.getByTestId('category'), { target: { value: 'mine' } });
    expect(screen.queryByTestId('suggested-category')).toBeNull();
    expect((screen.getByTestId('category') as HTMLInputElement).value).toBe('mine');
  });

  it('ignore une réponse arrivée pour un ancien libellé', () => {
    let resolve: (id: string) => void = () => {};
    predict.mutate.mockImplementation((_v, o) => { resolve = (id) => o.onSuccess({ categoryId: id }); });
    renderForm();
    type('loyer');
    act(() => { vi.advanceTimersByTime(700); });
    type('l');
    act(() => resolve('late'));
    expect((screen.getByTestId('category') as HTMLInputElement).value).toBe('');
  });

  it('aucune catégorie renvoyée ou échec : rien, aucun message', () => {
    answer(null);
    renderForm();
    type('loyer');
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.queryByTestId('suggested-category')).toBeNull();
    predict.mutate.mockImplementation((_v, o) => o.onError?.(new Error('x')));
    type('loyers');
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.queryByTestId('suggested-category')).toBeNull();
  });

  it('la mention est le texte exact fr / en', () => {
    expect(fr.Transactions.suggested_category).toBe('Catégorie suggérée automatiquement');
    expect(en.Transactions.suggested_category).toBe('Category suggested automatically');
  });
});
