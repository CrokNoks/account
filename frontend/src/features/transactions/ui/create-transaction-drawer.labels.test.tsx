import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { CreateTransactionDrawer } from './create-transaction-drawer';

const createTransaction = vi.fn();
const createTransfer = vi.fn();
let desktop = false;

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


const renderDrawer = (locale: 'fr' | 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <CreateTransactionDrawer />
    </NextIntlClientProvider>,
  );
const buttonLabels = () => {
  const form = document.querySelector('form') as HTMLFormElement;
  const submit = form.querySelector('button[type="submit"]') as HTMLElement;
  const another = Array.from(form.querySelectorAll('button[type="button"]')).find((b) =>
    b.compareDocumentPosition(submit) !== 0 && b.closest('div.flex-col.gap-3'),
  ) as HTMLElement;
  return { submit, another };
};
const text = (el: HTMLElement) => (el.querySelector('span') as HTMLElement).textContent;

beforeEach(() => {
  desktop = false;
});

describe('saisie : montant vide et libellés suivent la langue', () => {
  it('mobile fr : placeholder 0,00, « Ajouter » (principal, en premier) puis « Ajouter et en saisir une autre »', () => {
    renderDrawer('fr');
    expect(screen.getByPlaceholderText('0,00')).toBeTruthy();
    const { submit, another } = buttonLabels();
    expect(text(submit)).toBe('Ajouter');
    expect(text(another)).toBe('Ajouter et en saisir une autre');
    expect(submit.className).not.toContain('order-first');
    // Ordre réel du DOM (= ordre clavier) : « Ajouter » avant « Ajouter et en saisir une autre ».
    expect(submit.compareDocumentPosition(another) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('mobile en : 0.00, Add, Add and enter another', () => {
    renderDrawer('en');
    expect(screen.getByPlaceholderText('0.00')).toBeTruthy();
    const { submit, another } = buttonLabels();
    expect(text(submit)).toBe('Add');
    expect(text(another)).toBe('Add and enter another');
  });

  it('bureau fr : libellés inchangés, ordre inchangé', () => {
    desktop = true;
    renderDrawer('fr');
    expect(screen.getByPlaceholderText('0,00')).toBeTruthy();
    const { submit, another } = buttonLabels();
    expect(text(submit)).toBe('Enregistrer');
    expect(text(another)).toBe('Enregistrer & Nouveau');
    expect(submit.className).not.toContain('order-first');
    // Bureau : l'autre bouton reste avant.
    expect(another.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
