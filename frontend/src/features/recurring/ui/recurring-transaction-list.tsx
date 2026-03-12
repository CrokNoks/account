'use client';

import { useState } from 'react';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useRecurringTransactions, RecurringTransaction } from '../api/use-recurring-transactions';
import { useDeleteRecurringTransaction } from '../api/use-delete-recurring-transaction';
import { useUpdateRecurringTransaction } from '../api/use-update-recurring-transaction';
import { useCategories } from '@/features/categories/api/use-categories';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { formatCurrency } from '@/shared/lib/format';
import { Badge } from '@/components/ui/badge';
import { Trash2, CalendarDays, Pencil } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function RecurringTransactionList() {
  const t = useTranslations('Recurring');
  const { activeAccountId } = useAccountStore();
  const { data: transactions, isLoading } = useRecurringTransactions(activeAccountId);
  const { data: categories } = useCategories(activeAccountId);
  const { mutate: deleteRecurring } = useDeleteRecurringTransaction();
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);

  const handleDelete = (id: string) => {
    if (!activeAccountId || !confirm(t('delete_confirm'))) return;
    deleteRecurring({ accountId: activeAccountId, id }, {
      onSuccess: () => toast.success(t('deleted'))
    });
  };

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">{t('fields.day_of_month')}</TableHead>
              <TableHead>{t('fields.description')}</TableHead>
              <TableHead>{t('fields.category')}</TableHead>
              <TableHead className="text-right">{t('fields.amount')}</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center">{t('empty')}</TableCell></TableRow>
            ) : (
              transactions?.map((tr) => (
                <TableRow key={tr.id} className="group">
                  <TableCell className="font-medium flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    {tr.dayOfMonth}
                  </TableCell>
                  <TableCell>{tr.description}</TableCell>
                  <TableCell>
                    {tr.categoryId ? (
                      <Badge variant="outline" style={{ 
                        borderColor: categories?.find(c => c.id === tr.categoryId)?.color,
                        color: categories?.find(c => c.id === tr.categoryId)?.color 
                      }}>
                        {categories?.find(c => c.id === tr.categoryId)?.name || 'Categorized'}
                      </Badge>
                    ) : (
                      <span className="italic text-xs text-muted-foreground">Uncategorized</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-bold ${parseInt(tr.amount, 10) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatCurrency(tr.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditingRecurring(tr)} className="h-8 w-8">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(tr.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
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

      {editingRecurring && (
        <EditRecurringDialog 
          transaction={editingRecurring} 
          open={!!editingRecurring} 
          onOpenChange={(o) => !o && setEditingRecurring(null)} 
        />
      )}
    </div>
  );
}

function EditRecurringDialog({ transaction, open, onOpenChange }: { transaction: RecurringTransaction, open: boolean, onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('Recurring');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { data: categories } = useCategories(activeAccountId);
  
  const [description, setDescription] = useState(transaction.description);
  const [categoryId, setCategoryId] = useState(transaction.categoryId || '');
  const [amount, setAmount] = useState((parseInt(transaction.amount, 10) / 100).toString());
  const [dayOfMonth, setDayOfMonth] = useState(transaction.dayOfMonth.toString());
  
  const { mutate: updateRecurring, isPending } = useUpdateRecurringTransaction();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    updateRecurring({
      accountId: activeAccountId,
      id: transaction.id,
      data: {
        description,
        categoryId: categoryId || null,
        amount: Math.round(parseFloat(amount) * 100).toString(),
        dayOfMonth: parseInt(dayOfMonth, 10),
      }
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tc('edit')} {t('title').toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.description')}</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fields.category')}</label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v || '')}>
                <SelectTrigger>
                  <SelectValue>
                    {categoryId ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categories?.find(c => c.id === categoryId)?.color }} />
                        {categories?.find(c => c.id === categoryId)?.name}
                      </div>
                    ) : "Select category"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fields.day_of_month')}</label>
              <Input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.amount')}</label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{tc('save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
