'use client';

import { 
  StatStartBalance,
  StatRealIncome,
  StatRealExpenses,
  StatBankBalance,
  StatUpcomingBalance,
  StatForecastBalance,
  StatCard
} from "@/features/reporting/ui/dashboard-stats";
import { AnomaliesWidget } from "@/features/reporting/ui/anomalies-widget";
import { BudgetBreakdown } from "@/features/reporting/ui/budget-breakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagStatsSummary } from "@/features/tags/ui/tag-stats-summary";
import { PieChart as PieChartIcon, Receipt } from "lucide-react";
import { SavingsGoalsWidget } from "@/features/savings/ui/savings-goals-widget";
import { NetWorthWidget } from "@/features/reporting/ui/net-worth-widget";
import { UpcomingDeadlinesWidget } from "@/features/reporting/ui/upcoming-deadlines-widget";
import { MonthlyPulseWidget } from "@/features/reporting/ui/monthly-pulse-widget";
import { TopExpensesWidget } from "@/features/reporting/ui/top-expenses-widget";
import { AIInsightsCard } from "@/features/reporting/ui/ai-insights-card";
import { TransactionList } from "@/features/transactions/ui/transaction-list";
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
import { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Settings2, Check, X, GripVertical, Monitor, Smartphone, PlusCircle } from "lucide-react";
import { useUserPreferences, useUpdateUserPreferences } from "@/features/preferences/api/use-user-preferences";
import { useDashboardStore } from "@/features/preferences/model/use-dashboard-store";
import { cn } from "@/lib/utils";
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  'stat-start': StatStartBalance,
  'stat-income': StatRealIncome,
  'stat-expenses': StatRealExpenses,
  'stat-bank': StatBankBalance,
  'stat-upcoming': StatUpcomingBalance,
  'stat-forecast': StatForecastBalance,
  'anomalies': AnomaliesWidget,
  'net-worth': NetWorthWidget,
  'pulse': MonthlyPulseWidget,
  'top-expenses': TopExpensesWidget,
  'upcoming': UpcomingDeadlinesWidget,
  'insights': AIInsightsCard,
  'breakdown': () => (
    <div data-tour="budget-breakdown" className="h-full">
      <BudgetBreakdown />
    </div>
  ),
  'tags': TagStatsSummary,
  'savings': SavingsGoalsWidget,
  'transactions': () => (
    <div data-tour="transaction-list" className="h-full min-h-0">
      <Card className="border-2 shadow-sm h-full overflow-hidden flex flex-col pt-0">
        <TransactionList compact />
      </Card>
    </div>
  ),
};

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

  const allAvailableWidgets = useMemo(() => [
    { id: 'stat-start', label: 'Solde initial' },
    { id: 'stat-income', label: 'Revenus réels' },
    { id: 'stat-expenses', label: 'Dépenses réelles' },
    { id: 'stat-bank', label: 'Solde en banque' },
    { id: 'stat-upcoming', label: 'Solde à venir' },
    { id: 'stat-forecast', label: 'Solde prévisionnel' },
    { id: 'net-worth', label: 'Patrimoine Net' },
    { id: 'pulse', label: 'Le Pulse (vs M-1)' },
    { id: 'anomalies', label: 'Anomalies' },
    { id: 'insights', label: 'IA Insights' },
    { id: 'breakdown', label: 'Répartition du budget' },
    { id: 'top-expenses', label: 'Top Dépenses' },
    { id: 'tags', label: 'Statistiques par Tags' },
    { id: 'savings', label: 'Objectifs d\'épargne' },
    { id: 'upcoming', label: 'Prochaines Échéances' },
    { id: 'transactions', label: 'Dernières transactions' },
  ], []);

  const layout = useMemo(() => {
    if (isEditing && tempLayout) return tempLayout;
    return preferences?.dashboardLayout.widgets || [
      { id: 'stat-start', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-income', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-expenses', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-bank', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-upcoming', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-forecast', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'net-worth', width: 6, desktopVisible: true, mobileVisible: true },
      { id: 'pulse', width: 6, desktopVisible: true, mobileVisible: true },
      { id: 'anomalies', width: 12, desktopVisible: true, mobileVisible: true },
      { id: 'breakdown', width: 6, desktopVisible: true, mobileVisible: true },
      { id: 'top-expenses', width: 6, desktopVisible: true, mobileVisible: true },
      { id: 'transactions', width: 12, desktopVisible: true, mobileVisible: true },
    ];
  }, [isEditing, tempLayout, preferences]);

  const activeWidgets = useMemo(() => {
    return layout.map(w => ({
      ...w,
      label: allAvailableWidgets.find(aw => aw.id === w.id)?.label || w.id
    }));
  }, [layout, allAvailableWidgets]);

  const inactiveWidgets = useMemo(() => {
    return allAvailableWidgets.filter(aw => !layout.find(w => w.id === aw.id));
  }, [layout, allAvailableWidgets]);

  const handleStartEditing = () => {
    const currentWidgets = preferences?.dashboardLayout.widgets || [
      { id: 'stat-start', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-income', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-expenses', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-bank', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-upcoming', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-forecast', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'net-worth', width: 6, desktopVisible: true, mobileVisible: true },
      { id: 'pulse', width: 6, desktopVisible: true, mobileVisible: true },
      { id: 'anomalies', width: 12, desktopVisible: true, mobileVisible: true },
      { id: 'breakdown', width: 6, desktopVisible: true, mobileVisible: true },
      { id: 'top-expenses', width: 6, desktopVisible: true, mobileVisible: true },
      { id: 'transactions', width: 12, desktopVisible: true, mobileVisible: true },
    ];

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

function MiniWidget({ 
  id, label, width, desktopVisible, mobileVisible, onRemove, onWidthChange, onToggleDevice 
}: { 
  id: string, label: string, width: number, desktopVisible: boolean, mobileVisible: boolean,
  onRemove: () => void, onWidthChange: (width: number) => void, onToggleDevice: (device: 'mobile' | 'desktop') => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 0 };

  const toggleWidth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const widths = [2, 3, 4, 6, 12];
    const currentIndex = widths.indexOf(width);
    const nextWidth = widths[(currentIndex + 1) % widths.length];
    onWidthChange(nextWidth);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-grab active:cursor-grabbing min-h-[120px]",
        width === 2 && "col-span-12 lg:col-span-2",
        width === 3 && "col-span-12 lg:col-span-3",
        width === 4 && "col-span-12 lg:col-span-4",
        width === 6 && "col-span-12 lg:col-span-6",
        width === 12 && "col-span-12",
        "bg-primary/5 border-primary/20 hover:border-primary/50 text-foreground shadow-sm",
        isDragging && "opacity-50 scale-105 z-50 shadow-xl",
        (!desktopVisible || !mobileVisible) && "opacity-60"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <button onPointerDown={(e) => { e.stopPropagation(); onToggleDevice('desktop'); }} className={cn("p-1.5 rounded-full hover:bg-background/80 transition-colors", desktopVisible ? "text-primary" : "text-muted-foreground")} title={desktopVisible ? "Masquer sur Desktop" : "Afficher sur Desktop"}>
          <Monitor className="w-3.5 h-3.5" />
        </button>
        <button onPointerDown={(e) => { e.stopPropagation(); onToggleDevice('mobile'); }} className={cn("p-1.5 rounded-full hover:bg-background/80 transition-colors", mobileVisible ? "text-primary" : "text-muted-foreground")} title={mobileVisible ? "Masquer sur Mobile" : "Afficher sur Mobile"}>
          <Smartphone className="w-3.5 h-3.5" />
        </button>
        <button onPointerDown={(e) => { e.stopPropagation(); onRemove(); }} className="p-1.5 rounded-full text-destructive hover:bg-destructive/10 transition-colors" title="Supprimer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      
      <div className="flex flex-col items-center gap-2 mt-2">
        <GripVertical className="w-5 h-5 text-muted-foreground/30" />
        <span className="text-sm font-bold text-center px-2">{label}</span>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
        <button onPointerDown={(e) => { e.stopPropagation(); toggleWidth(e); }} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-background hover:bg-muted text-muted-foreground rounded-full border border-border/50 shadow-sm transition-colors">
          <div className="flex gap-0.5 items-center justify-center w-4 h-3">
            <div className={cn("bg-current rounded-full transition-all", width === 2 ? "w-1 h-1" : width === 3 ? "w-1.5 h-1.5" : width === 4 ? "w-2 h-1.5" : width === 6 ? "w-3 h-1.5" : "w-4 h-1.5")} />
          </div>
          {width}/12
        </button>
      </div>
    </div>
  );
}

function ManagementItem({ id, label, onAdd, onRemove, isActive = false }: { id: string, label: string, onAdd?: () => void, onRemove?: () => void, isActive?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 0 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all",
        isActive 
          ? "bg-primary text-primary-foreground border-primary shadow-sm cursor-grab active:cursor-grabbing" 
          : "bg-background text-muted-foreground border-dashed border-muted-foreground/30 hover:border-primary hover:text-primary cursor-pointer",
        isDragging && "opacity-50 scale-95"
      )}
      onClick={!isActive ? onAdd : undefined}
      {...(isActive ? attributes : {})}
      {...(isActive ? listeners : {})}
    >
      {isActive && <GripVertical className="w-3 h-3 opacity-50" />}
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
      {isActive && (
        <button onClick={(e) => { e.stopPropagation(); onRemove?.(); }} className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function SortableWidget({ 
  id, children, isEditing, width, desktopVisible, mobileVisible, onWidthChange, onToggleDevice 
}: { 
  id: string, children: React.ReactNode, isEditing: boolean, width: number,
  desktopVisible: boolean, mobileVisible: boolean, onWidthChange: (width: number) => void,
  onToggleDevice: (device: 'mobile' | 'desktop') => void
}) {
  if (!children) return null;

  return (
    <div 
      className={cn(
        "relative col-span-12 max-h-[80vh] flex flex-col",
        !desktopVisible && "lg:hidden",
        !mobileVisible && "hidden lg:flex",
        width === 2 && "lg:col-span-2",
        width === 3 && "lg:col-span-3",
        width === 4 && "lg:col-span-4",
        width === 6 && "lg:col-span-6",
        width === 12 && "lg:col-span-12"
      )}
    >
      {children}
    </div>
  );
}
