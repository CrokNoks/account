'use client';

import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { usePeriods } from "@/features/budgets/api/use-periods";
import { useAccounts } from "@/features/accounts/api/use-accounts";
import { useUiStore } from "@/shared/model/use-ui-store";
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { useRouter } from '@/i18n/routing';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { HelpButton } from "@/shared/ui/tour/HelpButton";
import { useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Settings2, Check, X, PlusCircle } from "lucide-react";
import { useUserPreferences, useUpdateUserPreferences } from "@/features/preferences/api/use-user-preferences";
import { useDashboardStore } from "@/features/preferences/model/use-dashboard-store";
import { 
  WIDGET_COMPONENTS, 
  ALL_AVAILABLE_WIDGETS, 
  DEFAULT_WIDGETS 
} from "@/features/preferences/config/dashboard-widgets";
import { 
  MiniWidget, 
  ManagementItem, 
  SortableWidget 
} from "@/features/preferences/ui/dashboard-editor-components";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

export default function Home() {
  const t = useTranslations('Dashboard');
  const router = useRouter();
  const { activeAccountId, activePeriodId, setActivePeriodId } = useAccountStore();
  const { startTour, completedTours } = useUiStore();
  const { data: accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { data: periods } = usePeriods(activeAccountId);

  const { data: preferences } = useUserPreferences();
  const { mutate: updatePreferences } = useUpdateUserPreferences();
  const { isEditing, setEditing, tempLayout, setTempLayout, toggleWidget, updateWidgetWidth, toggleDeviceVisibility } = useDashboardStore();

  const layout = useMemo(() => {
    if (isEditing && tempLayout) return tempLayout;
    return preferences?.dashboardLayout.widgets || DEFAULT_WIDGETS;
  }, [isEditing, tempLayout, preferences]);

  const activeWidgets = useMemo(() => {
    return layout.map(w => ({
      ...w,
      label: ALL_AVAILABLE_WIDGETS.find(aw => aw.id === w.id)?.label || w.id
    }));
  }, [layout]);

  const inactiveWidgets = useMemo(() => {
    return ALL_AVAILABLE_WIDGETS.filter(aw => !layout.find(w => w.id === aw.id));
  }, [layout]);

  const handleStartEditing = () => {
    const currentWidgets = preferences?.dashboardLayout.widgets || DEFAULT_WIDGETS;

    const normalizedWidgets = currentWidgets.map(w => ({
      ...w,
      desktopVisible: w.desktopVisible ?? true,
      mobileVisible: w.mobileVisible ?? true,
    }));

    setTempLayout(normalizedWidgets);
    setEditing(true);
  };

  const handleSaveLayout = () => {
    if (tempLayout) {
      updatePreferences({ widgets: tempLayout });
    }
    setEditing(false);
    setTempLayout(null);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setTempLayout(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = layout.findIndex(w => w.id === active.id);
      const newIndex = layout.findIndex(w => w.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        setTempLayout(arrayMove(layout, oldIndex, newIndex));
      }
    }
  }

  useEffect(() => {
    if (!isLoadingAccounts && (!accounts || accounts.length === 0)) {
      router.push('/accounts');
    }
  }, [accounts, isLoadingAccounts, router]);

  useEffect(() => {
    if (periods && periods.length > 0 && !activePeriodId) {
      const active = periods.find(p => p.isActive);
      if (active) setActivePeriodId(active.id);
      else setActivePeriodId(periods[0].id);
    }
  }, [periods, activePeriodId, setActivePeriodId]);

  useEffect(() => {
    if (!completedTours['dashboard'] && completedTours['account']) {
      const timer = setTimeout(() => {
        startTour('dashboard');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedTours, startTour]);

  const currentPeriod = periods?.find(p => p.id === activePeriodId);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
            <HelpButton tour="dashboard" className="h-8 w-8" />
            <Select value={activePeriodId || ""} onValueChange={setActivePeriodId}>
              <SelectTrigger className="h-8 rounded-full bg-primary/10 text-primary border-primary/20 px-4 hover:bg-primary/20 transition-colors">
                <SelectValue>
                  {currentPeriod 
                    ? `${format(new Date(currentPeriod.startDate), 'dd/MM/yyyy')} - ${format(new Date(currentPeriod.endDate), 'dd/MM/yyyy')}`
                    : "Sélectionner une période"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periods?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {format(new Date(p.startDate), 'dd/MM/yyyy')} - {format(new Date(p.endDate), 'dd/MM/yyyy')} {p.isActive && "(Active)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-muted-foreground">
            {t('welcome')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button variant="outline" size="icon" onClick={handleStartEditing} title="Personnaliser le dashboard" className="hidden lg:flex">
              <Settings2 className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
              <Button variant="outline" size="sm" onClick={handleCancelEdit} className="gap-2">
                <X className="w-4 h-4" /> Annuler
              </Button>
              <Button size="sm" onClick={handleSaveLayout} className="gap-2">
                <Check className="w-4 h-4" /> Enregistrer
              </Button>
            </div>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="p-8 bg-primary/5 border-2 border-primary/20 rounded-3xl animate-in slide-in-from-top-4 duration-300 space-y-8">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-primary">
              <Settings2 className="w-4 h-4" /> Disposition du Dashboard (Glissez pour réorganiser)
            </h3>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={layout.map(w => w.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-12 gap-4 bg-background/50 p-4 rounded-2xl border-2 border-dashed border-primary/20 min-h-[200px]">
                  {activeWidgets.map((widget) => (
                    <MiniWidget 
                      key={widget.id} 
                      id={widget.id} 
                      label={widget.label}
                      width={widget.width}
                      desktopVisible={widget.desktopVisible}
                      mobileVisible={widget.mobileVisible}
                      onRemove={() => toggleWidget(widget.id)}
                      onWidthChange={(newWidth) => updateWidgetWidth(widget.id, newWidth)}
                      onToggleDevice={(device) => toggleDeviceVisibility(widget.id, device)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-muted-foreground">
              <PlusCircle className="w-4 h-4" /> Widgets Disponibles
            </h3>
            <div className="flex flex-wrap gap-2">
              {inactiveWidgets.map((widget) => (
                <ManagementItem 
                  key={widget.id} 
                  id={widget.id} 
                  label={widget.label}
                  onAdd={() => toggleWidget(widget.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      
      {!isEditing && (
      <div className="grid grid-cols-12 gap-8">
        {layout.map((widget) => {
          const widgetId = widget.id;
          const WidgetComponent = WIDGET_COMPONENTS[widgetId];
          
          if (!WidgetComponent) return null;

          return (
            <SortableWidget 
              key={widgetId} 
              id={widgetId} 
              isEditing={isEditing}
              width={widget.width}
              desktopVisible={widget.desktopVisible}
              mobileVisible={widget.mobileVisible}
              onWidthChange={(newWidth) => updateWidgetWidth(widgetId, newWidth)}
              onToggleDevice={(device) => toggleDeviceVisibility(widgetId, device)}
            >
              <WidgetComponent />
            </SortableWidget>
          );
        })}
      </div>
      )}
    </div>
  );
}
