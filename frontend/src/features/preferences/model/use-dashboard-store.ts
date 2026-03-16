import { create } from 'zustand';
import { DashboardWidgetConfig } from '../api/use-user-preferences';

interface DashboardState {
  isEditing: boolean;
  setEditing: (isEditing: boolean) => void;
  tempLayout: DashboardWidgetConfig[] | null;
  setTempLayout: (layout: DashboardWidgetConfig[] | null) => void;
  toggleWidget: (widgetId: string) => void;
  updateWidgetWidth: (widgetId: string, width: number) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  isEditing: false,
  setEditing: (isEditing) => set({ isEditing }),
  tempLayout: null,
  setTempLayout: (tempLayout) => set({ tempLayout }),
  toggleWidget: (widgetId) => set((state) => {
    if (!state.tempLayout) return state;
    
    const exists = state.tempLayout.find(w => w.id === widgetId);
    const newLayout = exists
      ? state.tempLayout.filter(w => w.id !== widgetId)
      : [...state.tempLayout, { id: widgetId, width: 12 }];
      
    return { tempLayout: newLayout };
  }),
  updateWidgetWidth: (widgetId, width) => set((state) => {
    if (!state.tempLayout) return state;
    
    const newLayout = state.tempLayout.map(w => 
      w.id === widgetId ? { ...w, width } : w
    );
      
    return { tempLayout: newLayout };
  }),
}));
