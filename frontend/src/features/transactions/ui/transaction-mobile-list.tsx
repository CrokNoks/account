'use client';

import { Badge } from '@/components/ui/badge';
import { tintedBadgeStyle } from '@/shared/lib/badge-color';
import { CheckCircle2, Circle } from 'lucide-react';
import { formatShortDate } from '@/shared/lib/date-only';
import { usePresentAmount } from '@/features/reporting/lib/signed-amount';
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { AnomalyBadges } from './anomaly-badges';
import { OperationStateLabel } from './operation-state-label';
import { operationState } from '../model/operation-state';
import { AnomalyMark } from '../model/anomaly-marks';
import { Transaction } from '../model/types';
import { Category } from '@/features/categories/model/types';
import { Tag } from '@/features/tags/model/types';
import { useLocale, useTranslations } from 'next-intl';

interface TransactionMobileListProps {
  transactions: Transaction[];
  categories?: Category[];
  tags?: Tag[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  /** Pointer ou dépointer, selon l'état de la ligne (un geste). */
  onTogglePointage: (transaction: Transaction) => void;
  onTagClick: (tagId: string) => void;
  compact?: boolean;
  isUpdating?: boolean;
  /** Marques d'anomalie par identifiant de transaction. */
  anomalyMarks?: Record<string, AnomalyMark[]>;
  t: ReturnType<typeof useTranslations>;
}

export function TransactionMobileList({
  transactions,
  categories,
  tags,
  selectedIds,
  onToggleSelect,
  onEdit,
  onTogglePointage,
  onTagClick,
  compact,
  isUpdating,
  anomalyMarks,
  t
}: TransactionMobileListProps) {
  const present = usePresentAmount();
  const locale = useLocale();
  return (
    <div className="lg:hidden space-y-3">
      {transactions.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          {t('empty')}
        </div>
      ) : (
        transactions.map((transaction) => (
          <div 
            key={transaction.id} 
            className={cn(
              "p-4 rounded-xl border bg-card transition-all active:scale-[0.98] flex gap-3",
              operationState(transaction) === 'pointee' ? "border-green-500/20 bg-green-500/5" : "shadow-sm",
              selectedIds.includes(transaction.id) && "ring-2 ring-primary bg-primary/5"
            )}
            onClick={() => selectedIds.length > 0 ? onToggleSelect(transaction.id) : onEdit(transaction)}
          >
            <div onClick={(e) => e.stopPropagation()} className="flex items-center">
              {!compact && (
                <Checkbox 
                  checked={selectedIds.includes(transaction.id)} 
                  onCheckedChange={() => onToggleSelect(transaction.id)}
                />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePointage(transaction);
                    }} 
                    disabled={isUpdating}
                    aria-label={operationState(transaction) === 'pointee' ? t('unpoint') : t('point')}
                    className="shrink-0"
                  >
                    {operationState(transaction) === 'pointee' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 fill-green-500/10" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground/30" />
                    )}
                  </button>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold lg:truncate max-lg:line-clamp-2 max-lg:break-words">{transaction.description}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] max-lg:text-xs text-muted-foreground">{formatShortDate(transaction.date, locale)}</span>
                      {transaction.categoryId && (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] max-lg:text-xs py-0 text-foreground" style={tintedBadgeStyle(categories?.find(c => c.id === transaction.categoryId)?.color)}>
                          {categories?.find(c => c.id === transaction.categoryId)?.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={cn(
                    "text-sm font-black tracking-tight",
                    present(transaction.amount, 'flow').className
                  )}>
                    {present(transaction.amount, 'flow').text}
                  </span>
                  <OperationStateLabel state={operationState(transaction)} t={t} />
                </div>
              </div>
              {anomalyMarks?.[transaction.id] && (
                <div className="flex flex-wrap gap-1">
                  <AnomalyBadges marks={anomalyMarks[transaction.id]} t={t} />
                </div>
              )}
              {transaction.tagIds && transaction.tagIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {transaction.tagIds.map(tagId => {
                    const tag = tags?.find(t => t.id === tagId);
                    return (
                      <Badge 
                        key={tagId} 
                        variant="secondary" 
                        className="h-4 max-lg:h-5 px-1 text-[9px] max-lg:text-xs py-0 text-foreground cursor-pointer hover:brightness-90 transition-all"
                        style={tintedBadgeStyle(tag?.color)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTagClick(tagId);
                        }}
                      >
                        {tag?.name || t('tag_fallback')}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
