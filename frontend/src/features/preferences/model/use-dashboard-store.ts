import { create } from 'zustand';
import { DashboardWidgetConfig } from '../api/use-user-preferences';

interface DashboardState {
  isEditing: boolean;
  setEditing: (isEditing: boolean) => void;
  tempLayout: DashboardWidgetConfig[] | null;
  setTempLayout: (layout: DashboardWidgetConfig[] | null) => void;
  toggleWidget: (widgetId: string) => void;
  updateWidgetWidth: (widgetId: string, width: number) => void;
  toggleDeviceVisibility: (widgetId: string, device: 'mobile' | 'desktop') => void;
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
      : [...state.tempLayout, { id: widgetId, width: 12, desktopVisible: true, mobileVisible: true }];
      
    return { tempLayout: newLayout };
  }),
  updateWidgetWidth: (widgetId, width) => set((state) => {
    if (!state.tempLayout) return state;
    
    const newLayout = state.tempLayout.map(w => 
      w.id === widgetId ? { ...w, width } : w
    );
      
    return { tempLayout: newLayout };
  }),
  toggleDeviceVisibility: (widgetId, device) => set((state) => {
    if (!state.tempLayout) return state;
    
    const newLayout = state.tempLayout.map(w => {
      if (w.id === widgetId) {
        return {
          ...w,
          desktopVisible: device === 'desktop' ? !w.desktopVisible : w.desktopVisible,
          mobileVisible: device === 'mobile' ? !w.mobileVisible : w.mobileVisible,
        };
      }
      return w;
    });
      
    return { tempLayout: newLayout };
  }),
}));
