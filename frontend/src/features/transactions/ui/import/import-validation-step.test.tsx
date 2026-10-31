import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import fr from '../../../../../messages/fr.json';
import en from '../../../../../messages/en.json';
import { ImportValidationStep } from './import-validation-step';
import type { ParsedTransaction } from '../../model/import-types';

vi.mock('@/features/categories/api/use-categories', () => ({
  useCategories: () => ({
    data: [
      { id: 'c-b', name: 'Courses', color: '#111111' },
      { id: 'c-a', name: 'Abonnements', color: '#222222' },
    ],
    isLoading: false,
  }),
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

const rows: ParsedTransaction[] = [
  { id: 'r1', date: '2026-10-01', description: 'Loyer', amount: '-12.50', categoryId: null },
  { id: 'r2', date: '31/02/2026', description: 'Illisible', amount: '3', categoryId: null, invalidReason: 'date' },
];

function renderStep(locale: 'fr' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <ImportValidationStep parsedData={rows} setParsedData={vi.fn()} accountId="acc-1" />
    </NextIntlClientProvider>,
  );
}

describe('ImportValidationStep dates', () => {
  it('shows the dates in the French format', () => {
    renderStep('fr');
    expect(screen.getByText('01/10/2026')).toBeInTheDocument();
    expect(screen.queryByText('2026-10-01')).not.toBeInTheDocument();
  });

  it('shows the dates in the English format', () => {
    renderStep('en');
    expect(screen.getByText('10/01/2026')).toBeInTheDocument();
  });

  it('keeps an unreadable date as typed', () => {
    renderStep('fr');
    expect(screen.getByText('31/02/2026')).toBeInTheDocument();
  });
});

describe('ImportValidationStep category selector', () => {
  function renderWith(data: ParsedTransaction[], setParsedData = vi.fn()) {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <ImportValidationStep parsedData={data} setParsedData={setParsedData} accountId="acc-1" />
      </NextIntlClientProvider>,
    );
    return setParsedData;
  }

  it('shows the predicted category in the row selector', () => {
    renderWith([{ ...rows[0], categoryId: 'c-a', predicted: true }]);
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Abonnements');
  });

  it('uses the common selector: sorted, "Sans catégorie" label', async () => {
    renderWith([rows[0]]);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('combobox')[0]);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Sans catégorie',
      'Abonnements',
      'Courses',
    ]);
  });

  it('applies the clicked category and marks it as not predicted', async () => {
    const setParsedData = renderWith([{ ...rows[0], categoryId: 'c-a', predicted: true }]);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(screen.getByRole('option', { name: 'Courses' }));
    const updater = setParsedData.mock.calls[0][0] as (p: ParsedTransaction[]) => ParsedTransaction[];
    expect(updater([{ ...rows[0], categoryId: 'c-a', predicted: true }])[0]).toMatchObject({
      categoryId: 'c-b',
      predicted: false,
    });
  });

  it('sets categoryId to null for "Sans catégorie"', async () => {
    const setParsedData = renderWith([{ ...rows[0], categoryId: 'c-a', predicted: true }]);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(screen.getByRole('option', { name: 'Sans catégorie' }));
    const updater = setParsedData.mock.calls[0][0] as (p: ParsedTransaction[]) => ParsedTransaction[];
    expect(updater([{ ...rows[0], categoryId: 'c-a', predicted: true }])[0]).toMatchObject({
      categoryId: null,
      predicted: false,
    });
  });

  it('names each row selector after the row description', () => {
    renderWith([rows[0]]);
    expect(screen.getByRole('combobox', { name: 'Catégorie de : Loyer' })).toBeInTheDocument();
  });
});
