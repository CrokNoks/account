import { create } from 'zustand';

interface UiState {
  isCreateTransactionDrawerOpen: boolean;
  setCreateTransactionDrawerOpen: (open: boolean) => void;
  toggleCreateTransactionDrawer: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCreateTransactionDrawerOpen: false,
  setCreateTransactionDrawerOpen: (open) => set({ isCreateTransactionDrawerOpen: open }),
  toggleCreateTransactionDrawer: () => set((state) => ({ isCreateTransactionDrawerOpen: !state.isCreateTransactionDrawerOpen })),
}));
