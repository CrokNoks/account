import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTransactionDrawer } from './create-transaction-drawer';

const createTransaction = vi.fn();
const createTransfer = vi.fn();
let desktop = false;

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/shared/lib/use-is-desktop', () => ({ useIsDesktop: () => desktop }));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1' }),
}));
vi.mock('@/shared/model/use-ui-store', () => ({
  useUiStore: () => ({ isCreateTransactionDrawerOpen: true, setCreateTransactionDrawerOpen: vi.fn() }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({ usePeriods: () => ({ data: [] }) }));
vi.mock('../api/use-create-transaction', () => ({
  useCreateTransaction: () => ({ mutate: createTransaction, isPending: false }),
}));
vi.mock('../api/use-create-transfer', () => ({
  useCreateTransfer: () => ({ mutate: createTransfer, isPending: false }),
}));
vi.mock('../api/use-predict-category', () => ({ usePredictCategory: () => ({ mutate: vi.fn() }) }));
vi.mock('@/features/accounts/api/use-accounts', () => ({
  useAccounts: () => ({ data: [{ id: 'acc-1', name: 'A' }, { id: 'acc-2', name: 'B' }] }),
}));
vi.mock('@/features/tags/ui/tag-selector', () => ({ TagSelector: () => <div /> }));
vi.mock('@/features/categories/ui/category-selector', () => ({
  CategorySelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <button type="button" data-testid="category" onClick={() => onChange('cat-1')}>{value || 'none'}</button>
  ),
}));

const amount = () => screen.getByPlaceholderText('0.00') as HTMLInputElement;
const label = () => screen.getByPlaceholderText('form.description_placeholder_standard') as HTMLInputElement;
const transferBox = () => document.getElementById('transfer-field') as HTMLElement;
const dateInput = () => document.querySelector('input[type="date"]') as HTMLInputElement;

beforeEach(() => {
  createTransaction.mockReset();
  createTransfer.mockReset();
  desktop = false;
});

describe('tiroir mobile : cocher Virement conserve la saisie', () => {
  it('montant, libellé, date, catégorie et sens survivent au changement de mode, dans les deux sens', () => {
    render(<CreateTransactionDrawer />);
    fireEvent.change(amount(), { target: { value: '12,50' } });
    fireEvent.change(label(), { target: { value: 'Courses' } });
    fireEvent.change(dateInput(), { target: { value: '2026-03-04' } });
    fireEvent.click(screen.getByTestId('category'));
    fireEvent.click(screen.getByRole('button', { name: 'direction_income' }));

    fireEvent.click(screen.getByRole('button', { name: /more_options/ }));
    fireEvent.click(transferBox());

    expect(amount().value).toBe('12,50');
    expect((screen.getByPlaceholderText('form.description_placeholder_transfer') as HTMLInputElement).value).toBe('Courses');
    expect(dateInput().value).toBe('2026-03-04');

    fireEvent.click(transferBox());

    expect(amount().value).toBe('12,50');
    expect(label().value).toBe('Courses');
    expect(dateInput().value).toBe('2026-03-04');
    expect(screen.getByTestId('category').textContent).toBe('cat-1');
    expect(screen.getByRole('button', { name: 'direction_income' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('tiroir : bouton de fermeture', () => {
  it('44 px minimum sur mobile, inchangé sur bureau', () => {
    render(<CreateTransactionDrawer />);
    const close = screen.getByRole('button', { name: 'close' });
    expect(close.className).toContain('max-lg:size-11');
    expect(close.className).not.toMatch(/(^|\s)size-11/);
  });
});
