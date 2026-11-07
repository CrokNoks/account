import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { CashflowForecast } from './cashflow-forecast';

vi.mock('../api/use-cashflow-forecast', () => ({
  useCashflowForecast: () => ({ isLoading: false, data: { currentBalance: '100000', events: [] } }),
}));

describe('Courbe de trésorerie sans récurrence', () => {
  it("n'écrit pas de « 0 » parasite quand la liste d'événements est vide", () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <CashflowForecast accountId="a1" />
      </NextIntlClientProvider>,
    );
    const stray = Array.from(container.querySelectorAll('*')).filter(
      (el) => el.childNodes.length > 0 && Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent === '0'),
    );
    expect(stray).toEqual([]);
    expect(container.textContent).toContain('Aucune opération récurrente');
  });
});
