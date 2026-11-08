import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BottomNav } from './bottom-nav';

const setOpen = vi.fn();

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({ usePathname: () => '/fr' }));
vi.mock('./more-menu', () => ({ MoreMenu: () => <button className="min-h-11 min-w-11">more</button> }));
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

    expect(items).toHaveLength(5);
    expect(Array.from(items).map((i) => i.textContent)).toEqual(['today', 'operations', '', 'analysis', 'more']);
    expect(items[2]).toBe(plus);
    // Analyses pointe vers /analyses.
    expect(screen.getByRole('link', { name: 'analysis' }).getAttribute('href')).toBe('/analyses');

    expect(plus.getAttribute('data-tour')).toBe('nav-add');
    fireEvent.click(plus);
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it('chaque cible de la barre fait 44 px au moins', () => {
    render(<BottomNav />);
    for (const el of Array.from(screen.getByRole('navigation').children)) {
      expect(el.className).toMatch(/min-h-11|h-12|h-16/);
      expect(el.className).toMatch(/min-w-11|w-12/);
    }
  });

  it('the floating button no longer exists in the layout', () => {
    const layout = readFileSync(join(__dirname, '../../../app/[locale]/(dashboard)/layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/Mobile FAB|fixed bottom-/);
  });
});

describe('titres de page en mobile', () => {
  it("les pages de Réglages n'ont pas de h2 de titre : le titre est celui de l'en-tête", () => {
    const dir = join(__dirname, '../../../app/[locale]/(dashboard)');
    for (const page of ['categories', 'tags', 'recurring', 'smart-rules', 'accounts', 'settings', 'transactions/import']) {
      expect(readFileSync(join(dir, page, 'page.tsx'), 'utf8'), page).not.toContain('<h2');
    }
  });

  it("les écrans Analyses, Échéances et Budgets n'ont pas de h2 de titre : le titre est celui de l'en-tête", () => {
    const reporting = join(__dirname, '../../../features/reporting/ui');
    const budgets = join(__dirname, '../../../app/[locale]/(dashboard)/budgets/page.tsx');
    for (const file of [join(reporting, 'analyses-screen.tsx'), join(reporting, 'echeances-screen.tsx'), budgets]) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('<h2');
    }
  });
});

describe('mode « site pour ordinateur » des navigateurs mobiles', () => {
  it('the lg breakpoint (menu on the left) is reached by a 980px viewport', () => {
    const css = readFileSync(join(__dirname, '../../../app/[locale]/globals.css'), 'utf8');
    const m = css.match(/--breakpoint-lg:\s*([\d.]+)(rem|px)/);
    const px = m ? parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1) : 1024; // Tailwind default: 64rem
    expect(px).toBeLessThanOrEqual(980);
  });
});
