import { create } from 'zustand';

interface DashboardState {
  isEditing: boolean;
  setEditing: (isEditing: boolean) => void;
  tempLayout: string[] | null;
  setTempLayout: (layout: string[] | null) => void;
  toggleWidget: (widgetId: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  isEditing: false,
  setEditing: (isEditing) => set({ isEditing }),
  tempLayout: null,
  setTempLayout: (tempLayout) => set({ tempLayout }),
  toggleWidget: (widgetId) => set((state) => {
    if (!state.tempLayout) return state;
    
    const newLayout = state.tempLayout.includes(widgetId)
      ? state.tempLayout.filter(id => id !== widgetId)
      : [...state.tempLayout, widgetId];
      
    return { tempLayout: newLayout };
  }),
}));
