'use client';

import { useState } from 'react';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods, Period } from '@/features/budgets/api/use-periods';
import { useUpdatePeriod } from '../api/use-update-period';
import { useDeletePeriod } from '../api/use-delete-period';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Lock, Trash2, PieChart } from 'lucide-react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter 
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { EditPeriodBudgetsSheet } from './edit-period-budgets-sheet';

export function PeriodList() {
  const t = useTranslations('Budgets');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { data: periods, isLoading } = usePeriods(activeAccountId);
  const { mutate: updatePeriod, isPending: isUpdating } = useUpdatePeriod();
  const { mutate: deletePeriod, isPending: isDeleting } = useDeletePeriod();
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [editingBudgetsPeriodId, setEditingBudgetsPeriodId] = useState<string | null>(null);

  const handleClosePeriod = (period: Period) => {
    if (!activeAccountId || !confirm(t('close_period') + '?')) return;
    updatePeriod({
      accountId: activeAccountId,
      id: period.id,
      data: { isActive: false }
    }, {
      onSuccess: () => toast.success(t('updated'))
    });
  };

  const handleDelete = (id: string) => {
    if (!activeAccountId || !confirm(t('confirm_delete'))) return;

    deletePeriod({
      accountId: activeAccountId,
      id: id
    }, {
      onSuccess: () => {
        toast.success(t('deleted'));
      }
    });
  };

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  return (
    <>
      <div className="space-y-4">
        {periods?.map((period) => (
          <Card key={period.id} className={period.isActive ? "border-primary/50 group relative" : "group relative"}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {format(new Date(period.startDate), 'dd MMMM yyyy')} - {format(new Date(period.endDate), 'dd MMMM yyyy')}
              </CardTitle>
              <div className="flex items-center gap-2">
                {period.isActive && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 text-xs h-8"
                    onClick={() => handleClosePeriod(period)}
                    disabled={isUpdating}
                  >
                    <Lock className="w-3 h-3" />
                    {t('close_period')}
                  </Button>
                )}
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => setEditingBudgetsPeriodId(period.id)}
                    title="Modifier les budgets"
                  >
                    <PieChart className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    onClick={() => setEditingPeriod(period)}
                    title="Modifier les dates"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive"
                    onClick={() => handleDelete(period.id)}
                    title="Supprimer la période"
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {period.isActive && <Badge variant="default">{t('active')}</Badge>}
              </div>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>

      {editingPeriod && (
        <EditPeriodDialog 
          period={editingPeriod} 
          open={!!editingPeriod} 
          onOpenChange={(o) => !o && setEditingPeriod(null)} 
        />
      )}

      {editingBudgetsPeriodId && (
        <EditPeriodBudgetsSheet
          periodId={editingBudgetsPeriodId}
          open={!!editingBudgetsPeriodId}
          onOpenChange={(o) => !o && setEditingBudgetsPeriodId(null)}
        />
      )}
    </>
  );
}

function EditPeriodDialog({ period, open, onOpenChange }: { period: Period, open: boolean, onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('Budgets');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const [startDate, setStartDate] = useState(period.startDate.split('T')[0]);
  const [endDate, setEndDate] = useState(period.endDate.split('T')[0]);
  const [isActive, setIsActive] = useState(period.isActive);
  
  const { mutate: updatePeriod, isPending } = useUpdatePeriod();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    updatePeriod({
      accountId: activeAccountId,
      id: period.id,
      data: { startDate, endDate, isActive }
    }, {
      onSuccess: () => {
        toast.success(t('updated'));
        onOpenChange(false);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>{t('edit_period')}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('fields.start_date')}</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="h-11" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('fields.end_date')}</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="h-11" />
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-primary/5 p-4 rounded-xl border border-primary/10">
              <Checkbox id="active" checked={isActive} onCheckedChange={(checked) => setIsActive(!!checked)} />
              <label htmlFor="active" className="text-sm font-medium cursor-pointer">{t('fields.is_active')}</label>
            </div>
          </div>
          <SheetFooter className="p-6 border-t bg-muted/20">
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isPending}>
              {isPending ? tc('loading') : tc('save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
