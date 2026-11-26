import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { PeriodList } from './period-list';

// Stable reference, like react-query.
const periods = [{ id: 'p1', startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', isActive: true }];
const withNewer = [
  { id: 'p2', startDate: '2027-01-01T00:00:00.000Z', endDate: '2027-01-31T00:00:00.000Z', isActive: false },
  { id: 'p1', startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', isActive: false },
];
const state = { list: periods };
const apiError = vi.hoisted(() => ({ code: undefined as string | undefined }));
const deletion = vi.hoisted(() => ({ mutate: vi.fn(), preview: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/budgets/api/use-periods', () => ({
  usePeriods: () => ({ data: state.list, isLoading: false }),
}));
vi.mock('../api/use-update-period', () => ({
  useUpdatePeriod: () => ({
    mutate: (_cmd: unknown, opts?: { onError?: (e: unknown) => void }) => {
      if (apiError.code) opts?.onError?.({ isAxiosError: true, response: { data: { code: apiError.code } } });
    },
    isPending: false,
  }),
}));
vi.mock('../api/use-delete-period', () => ({
  useDeletePeriod: () => ({ mutate: deletion.mutate, isPending: false }),
}));
vi.mock('../api/fetch-period-deletion-preview', () => ({
  fetchPeriodDeletionPreview: deletion.preview,
}));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));

describe('PeriodList', () => {
  it('links the date labels of the edit drawer to their fields', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <PeriodList />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByTitle(fr.Budgets.edit_dates));

    expect(screen.getByLabelText(fr.Budgets.fields.start_date)).toHaveValue('2026-12-01');
    expect(screen.getByLabelText(fr.Budgets.fields.end_date)).toHaveValue('2026-12-31');
  });

  it('disables the active checkbox of a period that is not the latest, enables it for the latest', () => {
    state.list = withNewer;
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <PeriodList />
      </NextIntlClientProvider>,
    );
    const [editLatest, editOld] = screen.getAllByTitle(fr.Budgets.edit_dates);
    fireEvent.click(editOld);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(fr.Budgets.reactivate_only_latest)).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(editLatest);
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-disabled', 'true');
    state.list = periods;
  });

  it('shows the API refusal in the edit drawer when the new start date is before another period', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <PeriodList />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByTitle(fr.Budgets.edit_dates));
    apiError.code = 'PERIOD_BEFORE_EXISTING';
    fireEvent.click(screen.getByRole('button', { name: fr.Common.save }));
    apiError.code = undefined;

    expect(toast.error).toHaveBeenCalledWith(fr.Budgets.period_before_existing);
  });

  it('shows the API refusal when the closed period would start after the active one', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <PeriodList />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByTitle(fr.Budgets.edit_dates));
    apiError.code = 'PERIOD_AFTER_ACTIVE';
    fireEvent.click(screen.getByRole('button', { name: fr.Common.save }));
    apiError.code = undefined;

    expect(toast.error).toHaveBeenCalledWith(fr.Budgets.period_after_active);
  });

  describe('deleting a period', () => {
    const clickDelete = () => fireEvent.click(screen.getByTitle(fr.Budgets.delete_period));
    const renderList = () =>
      render(
        <NextIntlClientProvider locale="fr" messages={fr}>
          <PeriodList />
        </NextIntlClientProvider>,
      );
    const preview = (extra = {}) => ({
      removedPending: 4,
      keptTransactions: 5,
      reopen: null,
      origin: 'manual',
      ...extra,
    });
    let confirmSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      confirmSpy?.mockRestore();
      deletion.mutate.mockReset();
      deletion.preview.mockReset();
    });

    it('announces the number of upcoming bills removed and of transactions kept, and deletes nothing before the confirmation', async () => {
      deletion.preview.mockResolvedValue(preview());
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderList();
      clickDelete();

      await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
      expect(deletion.preview).toHaveBeenCalledWith('a1', 'p1');
      const message = confirmSpy.mock.calls[0][0] as string;
      expect(message).toContain('4 factures à venir');
      expect(message).toContain('5 transactions seront conservées');
      expect(message).not.toMatch(/réouverte/);
      // annuler la confirmation ne change rien
      expect(deletion.mutate).not.toHaveBeenCalled();
    });

    it('deletes only once the confirmation is accepted', async () => {
      deletion.preview.mockResolvedValue(preview());
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderList();
      clickDelete();

      await waitFor(() => expect(deletion.mutate).toHaveBeenCalledTimes(1));
      expect(deletion.mutate.mock.calls[0][0]).toEqual({ accountId: 'a1', id: 'p1' });
    });

    it('announces the reopened period by its dates (no amount) when the switch is undone', async () => {
      deletion.preview.mockResolvedValue(
        preview({ reopen: { periodId: 'p0', startDate: '2026-10-25', endDate: '2026-11-30' }, origin: 'trigger' }),
      );
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderList();
      clickDelete();

      await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
      const message = confirmSpy.mock.calls[0][0] as string;
      expect(message).toContain('25 octobre 2026');
      expect(message).toContain('30 novembre 2026');
      expect(message).toMatch(/rouverte/);
      expect(message).not.toMatch(/€|EUR/);
    });

    it('uses the singular and the "none" forms', async () => {
      deletion.preview.mockResolvedValue(preview({ removedPending: 1, keptTransactions: 0 }));
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderList();
      clickDelete();

      await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
      const message = confirmSpy.mock.calls[0][0] as string;
      expect(message).toContain('1 facture à venir issue des récurrentes sera supprimée');
      expect(message).toContain('Aucune transaction ne sera conservée');
    });

    it('disables the delete button of the period while the preview is read and the deletion runs: a double click starts one preview and one deletion', async () => {
      let release!: (v: unknown) => void;
      deletion.preview.mockReturnValue(new Promise((r) => (release = r)));
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      deletion.mutate.mockImplementation((_cmd: unknown, opts?: { onSettled?: () => void }) => opts?.onSettled?.());
      renderList();
      const button = screen.getByTitle(fr.Budgets.delete_period);
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(button).toBeDisabled());
      expect(deletion.preview).toHaveBeenCalledTimes(1);

      release(preview());
      await waitFor(() => expect(deletion.mutate).toHaveBeenCalledTimes(1));
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(button).not.toBeDisabled());
    });

    it('does not delete and says so when the preview cannot be read', async () => {
      deletion.preview.mockRejectedValue(new Error('network'));
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderList();
      clickDelete();

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(fr.Budgets.delete_preview_error));
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(deletion.mutate).not.toHaveBeenCalled();
    });

    it('formats the dates of the confirmation in English with the English interface', async () => {
      deletion.preview.mockResolvedValue(
        preview({ reopen: { periodId: 'p0', startDate: '2026-10-25', endDate: '2026-11-30' } }),
      );
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(
        <NextIntlClientProvider locale="en" messages={en}>
          <PeriodList />
        </NextIntlClientProvider>,
      );
      fireEvent.click(screen.getByTitle(en.Budgets.delete_period));

      await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
      const message = confirmSpy.mock.calls[0][0] as string;
      expect(message).toContain('October 25, 2026');
      expect(message).toContain('November 30, 2026');
    });
  });

  it('shows the period titles in the language of the interface, without time zone shift', () => {
    state.list = periods;
    const { unmount } = render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <PeriodList />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('1 décembre 2026 - 31 décembre 2026')).toBeInTheDocument();
    unmount();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <PeriodList />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('December 1, 2026 - December 31, 2026')).toBeInTheDocument();
  });
});
