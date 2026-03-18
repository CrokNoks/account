'use client';

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Pencil, Trash2, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/shared/lib/format';
import { cn } from "@/lib/utils";
import { Transaction } from '../model/types';
import { Category } from '@/features/categories/model/types';
import { Tag } from '@/features/tags/model/types';
import { useTranslations } from 'next-intl';

interface TransactionTableProps {
  transactions: Transaction[];
  categories?: Category[];
  tags?: Tag[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onToggleReconciliation: (id: string, currentStatus: boolean) => void;
  onMakeRecurring?: (transaction: Transaction) => void;
  onTagClick: (tagId: string) => void;
  compact?: boolean;
  isUpdating?: boolean;
  t: ReturnType<typeof useTranslations>; // Translation function
}

export function TransactionTable({
  transactions,
  categories,
  tags,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onToggleReconciliation,
  onMakeRecurring,
  onTagClick,
  compact,
  isUpdating,
  t
}: TransactionTableProps) {
  return (
    <div className="hidden lg:block border rounded-xl overflow-hidden bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            {!compact && (
              <TableHead className="w-[40px]">
                <Checkbox 
                  checked={transactions.length > 0 && selectedIds.length === transactions.length}
                  onCheckedChange={onToggleSelectAll}
                />
              </TableHead>
            )}
            <TableHead className="w-[50px]"></TableHead>
            <TableHead className="w-[120px]">{t('fields.date')}</TableHead>
            <TableHead className="min-w-[200px] max-w-[400px]">{t('fields.description')}</TableHead>
            <TableHead className="w-[180px]">{t('fields.category')}</TableHead>
            <TableHead className="text-right w-[150px]">{t('fields.amount')}</TableHead>
            <TableHead className="w-[120px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={compact ? 6 : 7} className="h-32 text-center text-muted-foreground">
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((transaction) => (
              <TableRow 
                key={transaction.id} 
                className={cn(
                  "group cursor-pointer",
                  transaction.pending && "bg-muted/20 opacity-80",
                  selectedIds.includes(transaction.id) && "bg-primary/5"
                )}
                onClick={() => selectedIds.length > 0 ? onToggleSelect(transaction.id) : onEdit(transaction)}
              >
                {!compact && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedIds.includes(transaction.id)} 
                      onCheckedChange={() => onToggleSelect(transaction.id)}
                    />
                  </TableCell>
                )}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => onToggleReconciliation(transaction.id, transaction.reconciled)}
                    disabled={isUpdating}
                    className="hover:scale-110 transition-transform"
                  >
                    {transaction.reconciled ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 fill-green-500/10" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground/30" />
                    )}
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground font-medium">
                  {format(new Date(transaction.date), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell className="max-w-[400px]">
                  <div className="truncate max-w-full" title={transaction.description}>
                    <div className="flex flex-col gap-1">
                      <span className="truncate font-bold">{transaction.description}</span>
                      <div className="flex gap-1 flex-wrap">
                        {transaction.tagIds?.map(tagId => {
                          const tag = tags?.find(t => t.id === tagId);
                          return (
                            <Badge 
                              key={tagId} 
                              variant="secondary" 
                              className="h-4 px-1 text-[9px] py-0 font-normal cursor-pointer hover:brightness-90 transition-all"
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
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="truncate max-w-full">
                    {transaction.categoryId ? (
                      <Badge variant="outline" className="gap-1.5" style={{ 
                        borderColor: categories?.find(c => c.id === transaction.categoryId)?.color,
                        color: categories?.find(c => c.id === transaction.categoryId)?.color 
                      }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categories?.find(c => c.id === transaction.categoryId)?.color }} />
                        {categories?.find(c => c.id === transaction.categoryId)?.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className={cn(
                  "text-right font-black tracking-tight",
                  parseInt(transaction.amount, 10) < 0 ? "text-red-500" : "text-green-500"
                )}>
                  <div className="flex flex-col items-end gap-0.5">
                    {formatCurrency(transaction.amount)}
                    {transaction.pending && (
                      <span className="text-[8px] uppercase tracking-widest text-orange-500 font-bold bg-orange-500/10 px-1 rounded">Attente</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!compact && onMakeRecurring && (
                      <Button variant="ghost" size="icon-xs" onClick={() => onMakeRecurring(transaction)} title="Rendre récurrente">
                        <Repeat className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-xs" onClick={() => onEdit(transaction)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" className="text-destructive" onClick={() => onDelete(transaction.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
