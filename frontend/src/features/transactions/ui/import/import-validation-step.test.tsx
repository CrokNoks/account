import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../../messages/fr.json';
import en from '../../../../../messages/en.json';
import { ImportValidationStep } from './import-validation-step';
import type { ParsedTransaction } from '../../model/import-types';

const rows: ParsedTransaction[] = [
  { id: 'r1', date: '2026-10-01', description: 'Loyer', amount: '-12.50', categoryId: null },
  { id: 'r2', date: '31/02/2026', description: 'Illisible', amount: '3', categoryId: null, invalidReason: 'date' },
];

function renderStep(locale: 'fr' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <ImportValidationStep parsedData={rows} setParsedData={vi.fn()} categories={[]} />
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
