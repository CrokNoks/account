import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { NetWorthWidget } from './net-worth-widget';

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1' }),
}));
vi.mock('../api/use-net-worth', () => ({
  useNetWorth: () => ({
    isLoading: false,
    data: {
      currentTotal: '150000',
      history: [{ amount: '100000' }, { amount: '150000' }],
    },
  }),
}));

describe('NetWorthWidget', () => {
  // Un widget masqué en CSS (mobile/desktop) est quand même monté : le graphique
  // ne doit pas dépendre de la taille mesurée du conteneur pour avoir une hauteur.
  it('does not warn about a chart without size on first render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <NetWorthWidget />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(/1\s?500/)).toBeInTheDocument();
    const sizeWarnings = warn.mock.calls.filter((c) => String(c[0]).includes('of chart should be greater than 0'));
    expect(sizeWarnings).toEqual([]);
  });
});
