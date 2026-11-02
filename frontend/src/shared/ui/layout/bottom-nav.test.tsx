import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BottomNav } from './bottom-nav';

const setOpen = vi.fn();

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({ usePathname: () => '/fr' }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));
vi.mock('@/shared/model/use-ui-store', () => ({
  useUiStore: (sel: (s: { setCreateTransactionDrawerOpen: typeof setOpen }) => unknown) =>
    sel({ setCreateTransactionDrawerOpen: setOpen }),
}));

describe('barre du bas (mobile)', () => {
  it('has a « + » in the middle that opens the transaction creation drawer', () => {
    render(<BottomNav />);
    const items = screen.getByRole('navigation').children;
    const plus = screen.getByRole('button', { name: 'add_transaction' });

    expect(items).toHaveLength(4);
    expect(items[2]).toBe(plus);

    fireEvent.click(plus);
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it('the floating button no longer exists in the layout', () => {
    const layout = readFileSync(join(__dirname, '../../../app/[locale]/(dashboard)/layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/Mobile FAB|fixed bottom-/);
  });
});

describe('titres de page en mobile', () => {
  it('each page hides its h2 below lg (the title is in the header)', () => {
    const dir = join(__dirname, '../../../app/[locale]/(dashboard)');
    for (const page of ['calendar', 'cashflow', 'evolution', 'flux', 'budgets', 'categories', 'tags', 'recurring', 'smart-rules', 'accounts', 'transactions/import']) {
      const src = readFileSync(join(dir, page, 'page.tsx'), 'utf8');
      const h2 = src.match(/<h2[^>]*>/)![0];
      const wrapperHidden = /className="flex flex-col gap-2 max-lg:hidden">\s*(<div className="flex items-center gap-3">[\s\S]*?<\/div>\s*)?<h2/.test(src);
      expect(h2.includes('max-lg:hidden') || wrapperHidden, page).toBe(true);
    }
  });
});
