import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { ALL_PERIODS, PeriodSelect } from './period-select';

const periods = [
  { id: 'p1', startDate: '2026-11-01', endDate: '2026-11-30', isActive: true },
  { id: 'p0', startDate: '2026-10-01', endDate: '2026-10-31', isActive: false },
];

const renderSelect = (value: string | null, allowAll = false, locale: 'fr' | 'en' = 'fr') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <PeriodSelect periods={periods} value={value} onChange={vi.fn()} allowAll={allowAll} />
    </NextIntlClientProvider>,
  );

describe('PeriodSelect', () => {
  it('shows the dates of the chosen period', () => {
    renderSelect('p1');
    expect(screen.getByRole('combobox').textContent).toContain('01/11/2026 - 30/11/2026');
  });

  it('asks to choose a period when none is selected', () => {
    renderSelect(null);
    expect(screen.getByRole('combobox').textContent).toContain('Sélectionner une période');
  });

  it('shows « toutes les périodes » only when allowed', () => {
    renderSelect(ALL_PERIODS, true);
    expect(screen.getByRole('combobox').textContent).toContain('Toutes les périodes');
  });

  it('is translated in English', () => {
    renderSelect(ALL_PERIODS, true, 'en');
    expect(screen.getByRole('combobox').textContent).toContain('All periods');
  });
});
