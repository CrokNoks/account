import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from './use-ui-store';
import { useAccountStore } from '@/features/accounts/model/use-account-store';

describe('useAccountStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAccountStore.setState({ activeAccountId: null, activePeriodId: null });
  });

  it('resets the active period when the account changes', () => {
    const { setActiveAccountId, setActivePeriodId } = useAccountStore.getState();

    setActiveAccountId('acc-1');
    setActivePeriodId('per-1');
    expect(useAccountStore.getState().activePeriodId).toBe('per-1');

    setActiveAccountId('acc-2');
    expect(useAccountStore.getState()).toMatchObject({
      activeAccountId: 'acc-2',
      activePeriodId: null,
    });
  });

  it('persists the selection in localStorage', () => {
    useAccountStore.getState().setActiveAccountId('acc-1');

    expect(JSON.parse(localStorage.getItem('account-storage')!).state).toMatchObject({
      activeAccountId: 'acc-1',
    });
  });
});

describe('useUiStore tours', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({
      activeTour: 'none',
      tourRun: false,
      tourStepIndex: 0,
      completedTours: {},
    });
  });

  it('starts a tour at the first step by default', () => {
    useUiStore.getState().startTour('dashboard');

    expect(useUiStore.getState()).toMatchObject({
      activeTour: 'dashboard',
      tourRun: true,
      tourStepIndex: 0,
    });
  });

  it('can start a tour at a given step', () => {
    useUiStore.getState().startTour('transactions', 3);

    expect(useUiStore.getState().tourStepIndex).toBe(3);
  });

  it('marks a tour as completed and stops it', () => {
    const { startTour, completeTour } = useUiStore.getState();
    startTour('account', 2);

    completeTour('account');

    expect(useUiStore.getState()).toMatchObject({
      completedTours: { account: true },
      activeTour: 'none',
      tourRun: false,
      tourStepIndex: 0,
    });
  });

  it('stopping a tour does not mark it as completed', () => {
    const { startTour, stopTour } = useUiStore.getState();
    startTour('dashboard');

    stopTour();

    expect(useUiStore.getState().completedTours).toEqual({});
    expect(useUiStore.getState().tourRun).toBe(false);
  });

  // Comportement actuel documenté (docs/tour.md) : stocké dans le navigateur.
  it('persists completed tours in localStorage and can reset them', () => {
    const { completeTour, resetTours } = useUiStore.getState();
    completeTour('dashboard');

    expect(
      JSON.parse(localStorage.getItem('ui-storage')!).state.completedTours,
    ).toEqual({ dashboard: true });

    resetTours();
    expect(useUiStore.getState().completedTours).toEqual({});
  });

  it('toggles the drawers', () => {
    const { toggleCreateTransactionDrawer, toggleCreateAccountDialog } =
      useUiStore.getState();

    toggleCreateTransactionDrawer();
    toggleCreateAccountDialog();
    toggleCreateAccountDialog();

    expect(useUiStore.getState()).toMatchObject({
      isCreateTransactionDrawerOpen: true,
      isCreateAccountDialogOpen: false,
    });
  });
});
