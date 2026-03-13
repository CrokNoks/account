'use client';

import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useTagsSummary } from '../api/use-tags-summary';
import { useUiStore } from '@/shared/model/use-ui-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/shared/lib/format';
import { Badge } from '@/components/ui/badge';
import { BarChart3, ChevronRight, Tag as TagIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TagStatsSummary() {
  const { activeAccountId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  const setTagDetailId = useUiStore((state) => state.setTagDetailId);
  
  const activePeriod = periods?.find(p => p.isActive);
  const { data: summary, isLoading } = useTagsSummary(activeAccountId, activePeriod?.id);

  if (isLoading) return <div className="h-48 bg-muted animate-pulse rounded-xl" />;
  
  // Only show tags with activity
  const activeTags = summary?.filter(s => s.transactionCount > 0).slice(0, 5) || [];

  if (activeTags.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
          <BarChart3 className="w-4 h-4" />
          Top Tags de la période
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-2">
        {activeTags.map((tag) => (
          <button
            key={tag.tagId}
            onClick={() => setTagDetailId(tag.tagId)}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className="w-2 h-2 rounded-full shrink-0" 
                style={{ backgroundColor: tag.color }} 
              />
              <span className="text-sm font-medium truncate">{tag.name}</span>
              <Badge variant="secondary" className="h-4 px-1 text-[9px] font-normal opacity-70">
                {tag.transactionCount} op.
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-bold",
                BigInt(tag.totalAmount) < BigInt(0) ? "text-red-500" : "text-green-500"
              )}>
                {formatCurrency(tag.totalAmount)}
              </span>
              <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
