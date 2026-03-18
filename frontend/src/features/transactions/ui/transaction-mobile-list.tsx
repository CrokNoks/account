'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/shared/lib/format';
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Transaction } from '../model/types';
import { Category } from '@/features/categories/model/types';
import { Tag } from '@/features/tags/model/types';
import { useTranslations } from 'next-intl';

interface TransactionMobileListProps {
  transactions: Transaction[];
  categories?: Category[];
  tags?: Tag[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onToggleReconciliation: (id: string, currentStatus: boolean) => void;
  onTagClick: (tagId: string) => void;
  compact?: boolean;
  isUpdating?: boolean;
  t: ReturnType<typeof useTranslations>;
}

export function TransactionMobileList({
  transactions,
  categories,
  tags,
  selectedIds,
  onToggleSelect,
  onEdit,
  onToggleReconciliation,
  onTagClick,
  compact,
  isUpdating,
  t
}: TransactionMobileListProps) {
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
              transaction.reconciled ? "border-green-500/20 bg-green-500/5" : "shadow-sm",
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
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleReconciliation(transaction.id, transaction.reconciled);
                    }} 
                    disabled={isUpdating}
                    className="shrink-0"
                  >
                    {transaction.reconciled ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 fill-green-500/10" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground/30" />
                    )}
                  </button>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold truncate">{transaction.description}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{format(new Date(transaction.date), 'dd MMM')}</span>
                      {transaction.categoryId && (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] py-0" style={{ 
                          borderColor: categories?.find(c => c.id === transaction.categoryId)?.color,
                          color: categories?.find(c => c.id === transaction.categoryId)?.color 
                        }}>
                          {categories?.find(c => c.id === transaction.categoryId)?.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={cn(
                    "text-sm font-black tracking-tight",
                    parseInt(transaction.amount, 10) < 0 ? "text-red-500" : "text-green-500"
                  )}>
                    {formatCurrency(transaction.amount)}
                  </span>
                  {transaction.pending && (
                    <div className="flex items-center gap-1 text-orange-500 font-medium">
                      <Clock className="w-3 h-3 animate-pulse" />
                      <span className="text-[9px] uppercase tracking-wider">Attente</span>
                    </div>
                  )}
                </div>
              </div>
              {transaction.tagIds && transaction.tagIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {transaction.tagIds.map(tagId => {
                    const tag = tags?.find(t => t.id === tagId);
                    return (
                      <Badge 
                        key={tagId} 
                        variant="secondary" 
                        className="h-4 px-1 text-[9px] py-0 cursor-pointer hover:brightness-90 transition-all"
                        style={{ 
                          backgroundColor: tag?.color ? `${tag.color}20` : undefined,
                          color: tag?.color,
                          borderColor: tag?.color ? `${tag.color}40` : undefined
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTagClick(tagId);
                        }}
                      >
                        {tag?.name || 'Tag'}
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
