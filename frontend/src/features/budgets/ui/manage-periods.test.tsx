import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { ManagePeriods } from './manage-periods';

vi.mock('@/i18n/routing', () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('@/features/periods/ui/create-period-dialog', () => ({ CreatePeriodDialog: () => <button>create-period</button> }));
vi.mock('@/features/periods/ui/period-list', () => ({ PeriodList: () => <div>period-list</div> }));

describe('ManagePeriods', () => {
  afterEach(cleanup);

  it('keeps creating, editing/closing/deleting (the list) and the defaults link', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <ManagePeriods />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Gérer les périodes')).toBeTruthy();
    expect(screen.getByText('create-period')).toBeTruthy();
    expect(screen.getByText('period-list')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/budgets/fixed');
  });
});
