import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { usePeriodSwitchNotice } from './use-period-switch-notice';

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const periodSwitch = {
  closed: { id: 'p1', startDate: '2026-10-01', endDate: '2026-11-30' },
  opened: { id: 'p2', startDate: '2026-12-01', endDate: '2026-12-27' },
  count: 1,
  dateChanged: false,
};

const wrapperFor = (locale: string, messages: typeof fr) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>;
  };

describe('usePeriodSwitchNotice', () => {
  beforeEach(() => vi.mocked(toast.success).mockReset());

  it('says nothing without a switch in the response', () => {
    const { result } = renderHook(() => usePeriodSwitchNotice(), { wrapper: wrapperFor('fr', fr) });

    result.current({ id: 't1' });
    result.current(undefined);

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows the closed and the opened period in french', () => {
    const { result } = renderHook(() => usePeriodSwitchNotice(), { wrapper: wrapperFor('fr', fr) });

    result.current({ id: 't1', periodSwitch });

    expect(toast.success).toHaveBeenCalledWith(
      'Période du 01/10/2026 au 30/11/2026 clôturée ; nouvelle période du 01/12/2026 au 27/12/2026.',
      undefined,
    );
  });

  it('shows them in english, with the dates in the english format', () => {
    const { result } = renderHook(() => usePeriodSwitchNotice(), { wrapper: wrapperFor('en', en as typeof fr) });

    result.current({ id: 't1', periodSwitch });

    expect(toast.success).toHaveBeenCalledWith(
      'Period from 10/01/2026 to 11/30/2026 closed; new period from 12/01/2026 to 12/27/2026.',
      undefined,
    );
  });

  it('adds that the date became today when the transaction left pending', () => {
    const { result } = renderHook(() => usePeriodSwitchNotice(), { wrapper: wrapperFor('fr', fr) });

    result.current({ id: 't1', periodSwitch: { ...periodSwitch, dateChanged: true } });

    expect(toast.success).toHaveBeenCalledWith(expect.any(String), {
      description: fr.Transactions.period_switch_date_today,
    });
  });

  it('summarises an import that opened several periods', () => {
    const { result } = renderHook(() => usePeriodSwitchNotice(), { wrapper: wrapperFor('fr', fr) });

    result.current([{ id: 't1', periodSwitch: { ...periodSwitch, count: 3 } }]);

    expect(toast.success).toHaveBeenCalledWith(
      '3 périodes ouvertes ; la dernière va du 01/12/2026 au 27/12/2026.',
      undefined,
    );
  });

  it('tells how many pending recurring were removed and how many remain (import)', () => {
    const { result } = renderHook(() => usePeriodSwitchNotice(), { wrapper: wrapperFor('fr', fr) });

    result.current([{ id: 't1', periodSwitch: { ...periodSwitch, removedPending: 2, remainingPending: 1 } }]);

    expect(toast.success).toHaveBeenCalledWith(expect.any(String), {
      description:
        '2 récurrentes en attente supprimées : leurs lignes sont déjà importées. 1 récurrente reste en attente dans la période clôturée.',
    });
  });

  it('tells it in english, singular form', () => {
    const { result } = renderHook(() => usePeriodSwitchNotice(), { wrapper: wrapperFor('en', en as typeof fr) });

    result.current([{ id: 't1', periodSwitch: { ...periodSwitch, removedPending: 1, remainingPending: 0 } }]);

    expect(toast.success).toHaveBeenCalledWith(expect.any(String), {
      description: '1 pending recurring removed: its line is already imported.',
    });
  });

  it('adds nothing when nothing was removed or remains', () => {
    const { result } = renderHook(() => usePeriodSwitchNotice(), { wrapper: wrapperFor('fr', fr) });

    result.current([{ id: 't1', periodSwitch: { ...periodSwitch, removedPending: 0, remainingPending: 0 } }]);

    expect(toast.success).toHaveBeenCalledWith(expect.any(String), undefined);
  });
});
