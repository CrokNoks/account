import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import fr from '../../../../messages/fr.json';
import { OverrunsList } from './overruns-by-period';

const wrap = (ui: React.ReactElement) => render(<NextIntlClientProvider locale="fr" messages={fr}>{ui}</NextIntlClientProvider>);

describe('OverrunsList', () => {
  it('shows a message when there is no closed period', () => {
    wrap(<OverrunsList periods={[]} />);
    expect(screen.getByTestId('overruns-empty').textContent).toContain('Aucune période fermée');
  });

  it('shows a message for a closed period without overrun', () => {
    wrap(<OverrunsList periods={[{ periodId: 'p', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-31T00:00:00.000Z', overruns: [] }]} />);
    expect(screen.getByTestId('overruns-period-empty').textContent).toContain('Aucun dépassement');
  });

  it('lists the overruns in the order received, one section per period', () => {
    wrap(
      <OverrunsList
        periods={[
          { periodId: 'p2', startDate: '2026-02-01T00:00:00.000Z', endDate: '2026-02-28T00:00:00.000Z', overruns: [{ categoryId: 'c', name: 'Courses', budget: '-10000', real: '-12000', overrun: '2000' }] },
          { periodId: 'p1', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-31T00:00:00.000Z', overruns: [] },
        ]}
      />,
    );
    expect(screen.getAllByTestId('overruns-period')).toHaveLength(2);
    expect(screen.getByTestId('overruns-row').textContent).toContain('Courses');
    expect(screen.getByTestId('overruns-row').textContent).toMatch(/20,00/);
  });
});
