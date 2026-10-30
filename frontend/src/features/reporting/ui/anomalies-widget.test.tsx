import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import { AnomaliesWidget } from './anomalies-widget';

const ignoreAnomaly = vi.fn();

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1', activePeriodId: 'per-1' }),
}));
vi.mock('../api/use-anomalies', () => ({
  useAnomalies: () => ({
    isLoading: false,
    data: [
      { id: 'an-1', type: 'duplicate', severity: 'high', title: 'Doublon', description: 'Deux fois', transactionIds: ['t1', 't2'] },
    ],
  }),
}));
vi.mock('../api/use-ignore-anomaly', () => ({
  useIgnoreAnomaly: () => ({ mutate: ignoreAnomaly }),
}));

function renderWidget() {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <AnomaliesWidget />
    </NextIntlClientProvider>,
  );
}

describe('AnomaliesWidget ignore error', () => {
  beforeEach(() => {
    ignoreAnomaly.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('shows the API message once and restores the anomaly', () => {
    ignoreAnomaly.mockImplementation((_vars, opts) =>
      opts.onError({ response: { data: { message: 'Anomalie introuvable' } } }),
    );
    renderWidget();
    fireEvent.click(screen.getByTitle(fr.Reporting.anomalies.ignore));

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('Anomalie introuvable');
    expect(screen.getByText('Doublon')).toBeTruthy();
  });

  it('falls back to the translated message when the API gave none', () => {
    ignoreAnomaly.mockImplementation((_vars, opts) => opts.onError(new Error('Network Error')));
    renderWidget();
    fireEvent.click(screen.getByTitle(fr.Reporting.anomalies.ignore));

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(fr.Reporting.anomalies.update_error);
  });
});
