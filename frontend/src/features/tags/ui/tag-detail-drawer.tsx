'use client';

import { useUiStore } from '@/shared/model/use-ui-store';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useTagDetails } from '../api/use-tag-details';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency } from '@/shared/lib/format';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { Receipt, BarChart3, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TagDetailDrawer() {
  const { tagDetailId, setTagDetailId } = useUiStore();
  const { activeAccountId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  
  const activePeriod = periods?.find(p => p.isActive);
  
  const { data: details, isLoading } = useTagDetails(
    activeAccountId, 
    tagDetailId, 
    activePeriod?.id
  );

  const handleOpenChange = (open: boolean) => {
    if (!open) setTagDetailId(null);
  };

  if (!tagDetailId) return null;

  return (
    <Sheet open={!!tagDetailId} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full shrink-0" 
              style={{ backgroundColor: details?.summary.color || '#94a3b8' }} 
            />
            <SheetTitle className="text-2xl">{details?.summary.name || 'Chargement...'}</SheetTitle>
          </div>
          {activePeriod && (
            <p className="text-sm text-muted-foreground">
              Statistiques pour la période actuelle
            </p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-20 bg-muted rounded-xl" />
              <div className="h-40 bg-muted rounded-xl" />
              <div className="h-40 bg-muted rounded-xl" />
            </div>
          ) : details ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <BarChart3 className="w-3 h-3" />
                    TOTAL NET
                  </div>
                  <div className={cn(
                    "text-xl font-bold",
                    BigInt(details.summary.totalAmount) < BigInt(0) ? "text-red-500" : "text-green-500"
                  )}>
                    {formatCurrency(details.summary.totalAmount)}
                  </div>
                </div>
                <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Receipt className="w-3 h-3" />
                    OPÉRATIONS
                  </div>
                  <div className="text-xl font-bold">
                    {details.summary.transactionCount}
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                    <BarChart3 className="w-4 h-4" />
                    Répartition par catégorie
                  </h3>
                </div>
                <div className="space-y-4 p-4 rounded-xl border bg-muted/20">
                  {details.categoryBreakdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Aucune donnée disponible</p>
                  ) : (
                    details.categoryBreakdown.map((cat) => (
                      <div key={cat.categoryId || 'none'} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium truncate">{cat.name}</span>
                          <span className="font-bold">{formatCurrency(cat.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={cat.percentage} className="h-1.5" />
                          <span className="text-[10px] text-muted-foreground w-8 text-right font-medium">
                            {cat.percentage}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                    <List className="w-4 h-4" />
                    Dernières opérations
                  </h3>
                </div>
                <div className="space-y-2">
                  {details.recentTransactions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Aucune transaction avec ce tag</p>
                  ) : (
                    details.recentTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-default">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{tx.description}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(tx.date), 'dd MMM yyyy')}
                          </p>
                        </div>
                        <div className={cn(
                          "text-sm font-bold ml-2",
                          parseInt(tx.amount, 10) < 0 ? "text-red-500" : "text-green-500"
                        )}>
                          {formatCurrency(tx.amount)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Erreur lors du chargement des données.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
