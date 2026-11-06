import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { ClosedPeriodWarning } from './closed-period-warning';

const closed = { id: 'p0', startDate: '2026-10-01', endDate: '2026-10-31', isActive: false };
const open = { ...closed, id: 'p1', isActive: true };

const renderWarning = (period: typeof closed | undefined, locale: 'fr' | 'en' = 'fr') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <ClosedPeriodWarning period={period} />
    </NextIntlClientProvider>,
  );

describe('ClosedPeriodWarning', () => {
  it('warns that past overruns will change on a closed period', () => {
    renderWarning(closed);
    expect(screen.getByRole('alert').textContent).toContain('dépassements passés');
  });

  it('is translated in English', () => {
    renderWarning(closed, 'en');
    expect(screen.getByRole('alert').textContent).toContain('past overruns');
  });

  it('shows nothing for an active period or no period', () => {
    renderWarning(open);
    expect(screen.queryByRole('alert')).toBeNull();
    renderWarning(undefined);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
