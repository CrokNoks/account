import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../../messages/fr.json';
import { ImportMappingStep } from './import-mapping-step';

const m = fr.Import.mapping;
const mapping = { date: 'Date', description: 'Libellé', amount: 'Montant', debit: 'Débit', credit: 'Crédit' };

function renderStep(amountMode: 'single' | 'separate') {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <ImportMappingStep
        amountMode={amountMode}
        setAmountMode={vi.fn()}
        headerRowIndex={2}
        handleHeaderRowChange={vi.fn()}
        mapping={mapping}
        setMapping={vi.fn()}
        csvHeaders={['Date', 'Libellé', 'Montant', 'Débit', 'Crédit']}
        rawRows={[]}
      />
    </NextIntlClientProvider>,
  );
}

describe('ImportMappingStep labels', () => {
  it('links the labels to their fields (single amount)', () => {
    renderStep('single');

    expect(screen.getByLabelText(m.header_row)).toHaveValue(2);
    expect(screen.getByLabelText(m.date_column)).toHaveTextContent('Date');
    expect(screen.getByLabelText(m.description_column)).toHaveTextContent('Libellé');
    expect(screen.getByLabelText(m.amount_column)).toHaveTextContent('Montant');
  });

  it('links the debit and credit labels to their selects (separate amounts)', () => {
    renderStep('separate');

    expect(screen.getByLabelText(m.debit_column)).toHaveTextContent('Débit');
    expect(screen.getByLabelText(m.credit_column)).toHaveTextContent('Crédit');
  });
});
