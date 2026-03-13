import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TourName = 'dashboard' | 'account' | 'transactions' | 'none';

interface UiState {
  isCreateTransactionDrawerOpen: boolean;
  setCreateTransactionDrawerOpen: (open: boolean) => void;
  toggleCreateTransactionDrawer: () => void;
  
  isCreateAccountDialogOpen: boolean;
  setCreateAccountDialogOpen: (open: boolean) => void;
  toggleCreateAccountDialog: () => void;

  tagDetailId: string | null;
  setTagDetailId: (id: string | null) => void;
  
  // Tour State
  activeTour: TourName;
  tourRun: boolean;
  tourStepIndex: number;
  completedTours: Record<string, boolean>;
  
  // Tour Actions
  startTour: (name: TourName, stepIndex?: number) => void;
  stopTour: () => void;
  setTourStepIndex: (index: number) => void;
  completeTour: (name: string) => void;
  resetTours: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isCreateTransactionDrawerOpen: false,
      setCreateTransactionDrawerOpen: (open) => set({ isCreateTransactionDrawerOpen: open }),
      toggleCreateTransactionDrawer: () => set((state) => ({ isCreateTransactionDrawerOpen: !state.isCreateTransactionDrawerOpen })),
      
      isCreateAccountDialogOpen: false,
      setCreateAccountDialogOpen: (open) => set({ isCreateAccountDialogOpen: open }),
      toggleCreateAccountDialog: () => set((state) => ({ isCreateAccountDialogOpen: !state.isCreateAccountDialogOpen })),

      tagDetailId: null,
      setTagDetailId: (id) => set({ tagDetailId: id }),

      // Tour Initial State
      activeTour: 'none',
      tourRun: false,
      tourStepIndex: 0,
      completedTours: {},
      
      // Tour Actions
      startTour: (name, stepIndex = 0) => set({ 
        activeTour: name, 
        tourRun: true, 
        tourStepIndex: stepIndex 
      }),
      stopTour: () => set({ 
        activeTour: 'none', 
        tourRun: false,
        tourStepIndex: 0
      }),
      setTourStepIndex: (index) => set({ tourStepIndex: index }),
      completeTour: (name) => set((state) => ({ 
        completedTours: { ...state.completedTours, [name]: true },
        activeTour: 'none',
        tourRun: false,
        tourStepIndex: 0
      })),
      resetTours: () => set({ completedTours: {} }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({ completedTours: state.completedTours }),
    }
  )
);
