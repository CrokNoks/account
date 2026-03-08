import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AccountState {
  activeAccountId: string | null;
  activePeriodId: string | null;
  setActiveAccountId: (id: string | null) => void;
  setActivePeriodId: (id: string | null) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      activeAccountId: null,
      activePeriodId: null,
      setActiveAccountId: (id) => set({ activeAccountId: id, activePeriodId: null }), // Reset period when account changes
      setActivePeriodId: (id) => set({ activePeriodId: id }),
    }),
    {
      name: 'account-storage',
    }
  )
);
