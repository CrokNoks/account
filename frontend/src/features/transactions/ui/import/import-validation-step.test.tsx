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

describe('ImportValidationStep montants', () => {
  it('écrit les montants en encre avec leur signe : ni vert ni rouge', () => {
    renderStep('fr');
    const cell = (text: RegExp) => screen.getByText(text).closest('td')!;
    const spent = cell(/-12,50/);
    const received = cell(/\+3,00/);
    for (const c of [spent, received]) {
      expect(c.className).toContain('text-foreground');
      expect(c.className).not.toMatch(/text-(red|green)/);
    }
  });
});

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

describe('ImportValidationStep lignes déjà présentes', () => {
  const marked: ParsedTransaction[] = [
    { id: 'd', date: '2026-10-01', description: 'Café', amount: '-2.50', categoryId: null, excluded: true, duplicateOf: { date: '2026-10-01T00:00:00.000Z', description: 'café' } },
    { id: 'n', date: '2026-10-02', description: 'Pain', amount: '-8.50', categoryId: null, nearOf: { date: '2026-10-01', description: 'Boulangerie' } },
    { id: 'x', date: '31/02/2026', description: 'Illisible', amount: '', categoryId: null, invalidReason: 'date' },
  ];

  function renderMarked(locale: 'fr' | 'en', setParsedData = vi.fn()) {
    render(
      <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
        <ImportValidationStep parsedData={marked} setParsedData={setParsedData} accountId="acc-1" />
      </NextIntlClientProvider>,
    );
    return setParsedData;
  }

  it('affiche la case décochée, les marques et les bandeaux (fr)', () => {
    renderMarked('fr');
    const [dup, near, invalid] = screen.getAllByRole('checkbox');
    expect(dup).toHaveAttribute('aria-checked', 'false');
    expect(near).toHaveAttribute('aria-checked', 'true');
    expect(invalid).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Déjà présente · 01/10/2026 · café')).toBeInTheDocument();
    expect(screen.getByText('Ligne proche · 01/10/2026 · Boulangerie')).toBeInTheDocument();
    expect(screen.getByText(/1 ligne écartée/)).toBeInTheDocument();
    expect(screen.getByText(/1 ligne proche d'une transaction existante/)).toBeInTheDocument();
  });

  it('affiche les textes en anglais', () => {
    renderMarked('en');
    expect(screen.getByText('Already present · 10/01/2026 · café')).toBeInTheDocument();
    expect(screen.getByText('Close line · 10/01/2026 · Boulangerie')).toBeInTheDocument();
    expect(screen.getByText(/1 line set aside/)).toBeInTheDocument();
  });

  it('recocher met à jour la ligne seulement', async () => {
    const setParsedData = renderMarked('fr');
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Importer : Café' }));
    const updater = setParsedData.mock.calls[0][0] as (p: ParsedTransaction[]) => ParsedTransaction[];
    const next = updater(marked);
    expect(next[0].excluded).toBe(false);
    expect(next[1]).toBe(marked[1]);
  });
});
