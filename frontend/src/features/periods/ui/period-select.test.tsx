import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import type { Period } from '../model/types';
import { ALL_PERIODS, PeriodSelect } from './period-select';

const periods = [
  { id: 'p1', startDate: '2026-11-01', endDate: '2026-11-30', isActive: true },
  { id: 'p0', startDate: '2026-10-01', endDate: '2026-10-31', isActive: false },
];

const renderSelect = (
  value: string | null,
  allowAll = false,
  locale: 'fr' | 'en' = 'fr',
  list: Period[] = periods,
) =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <PeriodSelect periods={list} value={value} onChange={vi.fn()} allowAll={allowAll} />
    </NextIntlClientProvider>,
  );

describe('PeriodSelect', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('shows the dates of the chosen period as short dates in the language', () => {
    renderSelect('p1');
    expect(screen.getByRole('combobox').textContent).toContain('1 nov. → 30 nov.');
  });

  it('falls back on the estimated end of an open period, never « null »', () => {
    const open = [{ id: 'p1', startDate: '2026-11-01', endDate: null, estimatedEndDate: '2026-11-30', isActive: true }];
    renderSelect('p1', false, 'fr', open);
    expect(screen.getByRole('combobox').textContent).toContain('1 nov. → 30 nov.');
  });

  it('shows only the start when the period has no end at all', () => {
    const open = [{ id: 'p1', startDate: '2026-11-01', endDate: null, estimatedEndDate: null, isActive: true }];
    renderSelect('p1', false, 'fr', open);
    const text = screen.getByRole('combobox').textContent;
    expect(text).toContain('1 nov.');
    expect(text).not.toMatch(/null|→/);
  });

  it('shows them in English order and adds the year of another year', () => {
    vi.setSystemTime(new Date(2027, 0, 15, 12));
    renderSelect('p1', false, 'en');
    expect(screen.getByRole('combobox').textContent).toContain('Nov 1, 2026 → Nov 30, 2026');
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
