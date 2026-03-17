'use client';

import { DashboardStats } from "@/features/reporting/ui/dashboard-stats";
import { AnomaliesWidget } from "@/features/reporting/ui/anomalies-widget";
import { BudgetBreakdown } from "@/features/reporting/ui/budget-breakdown";
import { Card, CardContent } from "@/components/ui/card";
import { TagStatsSummary } from "@/features/tags/ui/tag-stats-summary";
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
import { useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Settings2, Check, X, GripVertical } from "lucide-react";
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function Home() {
  const t = useTranslations('Dashboard');
  const router = useRouter();
  const { activeAccountId, activePeriodId, setActivePeriodId } = useAccountStore();
  const { startTour, completedTours } = useUiStore();
  const { data: accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { data: periods } = usePeriods(activeAccountId);

  const { data: preferences } = useUserPreferences();
  const { mutate: updatePreferences } = useUpdateUserPreferences();
  const { isEditing, setEditing, tempLayout, setTempLayout, toggleWidget, updateWidgetWidth } = useDashboardStore();

  const allAvailableWidgets = useMemo(() => [
    { id: 'stats', label: 'Statistiques globales' },
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
      { id: 'stats', width: 12 },
      { id: 'net-worth', width: 6 },
      { id: 'pulse', width: 6 },
      { id: 'anomalies', width: 12 },
      { id: 'breakdown', width: 6 },
      { id: 'top-expenses', width: 6 },
      { id: 'transactions', width: 12 },
    ];
  }, [isEditing, tempLayout, preferences]);

  const handleStartEditing = () => {
    setTempLayout(preferences?.dashboardLayout.widgets || [
      { id: 'stats', width: 12 },
      { id: 'net-worth', width: 6 },
      { id: 'pulse', width: 6 },
      { id: 'anomalies', width: 12 },
      { id: 'breakdown', width: 6 },
      { id: 'top-expenses', width: 6 },
      { id: 'transactions', width: 12 },
    ]);
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
      setTempLayout(arrayMove(layout, oldIndex, newIndex));
    }
  }

  // Redirect to accounts if none exist
  useEffect(() => {
    if (!isLoadingAccounts && (!accounts || accounts.length === 0)) {
      router.push('/accounts');
    }
  }, [accounts, isLoadingAccounts, router]);

  // Auto-select active period on first load if nothing selected
  useEffect(() => {
    if (periods && periods.length > 0 && !activePeriodId) {
      const active = periods.find(p => p.isActive);
      if (active) setActivePeriodId(active.id);
      else setActivePeriodId(periods[0].id);
    }
  }, [periods, activePeriodId, setActivePeriodId]);

  // Auto-start tour if dashboard tour not completed AND account tour IS completed
  useEffect(() => {
    if (!completedTours['dashboard'] && completedTours['account']) {
      // Small delay to ensure everything is rendered
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
            <Button variant="outline" size="icon" onClick={handleStartEditing} title="Personnaliser le dashboard">
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
        <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Sélectionner les widgets
          </h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {allAvailableWidgets.map(widget => (
              <Button
                key={widget.id}
                variant={layout.find(w => w.id === widget.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleWidget(widget.id)}
                className="rounded-full"
              >
                {widget.label}
              </Button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
            <GripVertical className="w-3 h-3" /> Glissez-déposez les widgets pour réorganiser. Cliquez sur l&apos;icône de taille pour redimensionner.
          </p>
        </div>
      )}
      
      <div className={cn("grid grid-cols-12 gap-8", isEditing && "opacity-80")}>
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={layout.map(w => w.id)}
            strategy={rectSortingStrategy}
            disabled={!isEditing}
          >
            {layout.map((widget) => {
              const widgetId = widget.id;
              return (
                <SortableWidget 
                  key={widgetId} 
                  id={widgetId} 
                  isEditing={isEditing}
                  width={widget.width}
                  onWidthChange={(newWidth) => updateWidgetWidth(widgetId, newWidth)}
                >
                  {widgetId === 'anomalies' && <AnomaliesWidget />}
                  {widgetId === 'stats' && <DashboardStats />}
                  {widgetId === 'net-worth' && <NetWorthWidget />}
                  {widgetId === 'pulse' && <MonthlyPulseWidget />}
                  {widgetId === 'top-expenses' && <TopExpensesWidget />}
                  {widgetId === 'upcoming' && <UpcomingDeadlinesWidget />}
                  {widgetId === 'insights' && currentPeriod?.isActive && (
                    <AIInsightsCard accountId={activeAccountId} periodId={activePeriodId} />
                  )}
                  {widgetId === 'breakdown' && (
                    <div data-tour="budget-breakdown">
                      <BudgetBreakdown title={<h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('breakdown')}</h2>} />
                    </div>
                  )}
                  {widgetId === 'tags' && <TagStatsSummary />}
                  {widgetId === 'savings' && <SavingsGoalsWidget />}
                  {widgetId === 'transactions' && (
                    <div data-tour="transaction-list" className="h-full">
                      <Card className="border-2 shadow-sm h-full overflow-hidden">
                        <CardContent className="p-6">
                          <TransactionList periodId={activePeriodId || undefined} compact />
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </SortableWidget>
              );
            })}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function SortableWidget({ 
  id, 
  children, 
  isEditing, 
  width,
  onWidthChange 
}: { 
  id: string, 
  children: React.ReactNode, 
  isEditing: boolean,
  width: number,
  onWidthChange: (width: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  if (!children) return null;

  const toggleWidth = () => {
    const widths = [4, 6, 12];
    const currentIndex = widths.indexOf(width);
    const nextWidth = widths[(currentIndex + 1) % widths.length];
    onWidthChange(nextWidth);
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "relative transition-all duration-200 col-span-12",
        width === 4 && "lg:col-span-4",
        width === 6 && "lg:col-span-6",
        width === 12 && "lg:col-span-12",
        isDragging && "opacity-50 scale-105 shadow-2xl",
        isEditing && "group p-2 border-2 border-dashed border-transparent hover:border-primary/20 rounded-3xl"
      )}
    >
      {isEditing && (
        <>
          <div 
            {...attributes} 
            {...listeners}
            className="absolute -left-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all cursor-grab active:cursor-grabbing z-50 hover:scale-110"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <button
            onClick={toggleWidth}
            className="absolute -right-2 top-1/2 -translate-y-1/2 p-2 bg-background border border-border text-foreground rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all z-50 hover:bg-muted"
            title="Redimensionner"
          >
            <div className="flex gap-0.5 items-center justify-center w-4 h-4">
              <div className={cn("bg-current rounded-full transition-all", width === 4 ? "w-1.5 h-1.5" : width === 6 ? "w-2.5 h-1.5" : "w-4 h-1.5")} />
            </div>
          </button>
        </>
      )}
      {children}
    </div>
  );
}
