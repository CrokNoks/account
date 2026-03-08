'use client';

import { useState, useEffect } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useCreateTransaction } from '../api/use-create-transaction';
import { Plus, Receipt } from 'lucide-react';
import { toast } from 'sonner';

export function CreateTransactionDrawer() {
  const { activeAccountId } = useAccountStore();
  const { data: categories } = useCategories(activeAccountId);
  const { data: periods } = usePeriods(activeAccountId);
  const { mutate: createTransaction, isPending } = useCreateTransaction();

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [amount, setAmount] = useState('');

  const activePeriod = periods?.find(p => p.isActive);

  const resetForm = () => {
    // Keep date as is for rapid entry
    setDescription('');
    setAmount('');
  };

  const handleSubmit = (addAnother = false) => {
    if (!activeAccountId || !description || !amount) return;

    createTransaction({
      accountId: activeAccountId,
      date,
      description,
      categoryId: categoryId || null,
      amount: (parseFloat(amount) * 100).toString(),
      periodId: activePeriod?.id,
    }, {
      onSuccess: () => {
        toast.success(`Transaction "${description}" added`);
        resetForm();
        if (!addAnother) {
          setOpen(false);
        }
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger 
        render={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add Transaction
          </Button>
        }
      />
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <SheetTitle>New Transaction</SheetTitle>
          </div>
          <SheetDescription>
            Quickly record a new income or expense for the active period.
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 py-8">
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input 
              placeholder="Rent, Groceries, Salary..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Amount</label>
            <div className="relative">
              <Input 
                type="number" 
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-12"
                required
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">€</span>
            </div>
            <p className="text-[10px] text-muted-foreground italic">Use negative value for expenses (ex: -10)</p>
          </div>
        </div>

        <SheetFooter className="flex-col gap-3 sm:flex-col">
          <Button 
            className="w-full" 
            onClick={() => handleSubmit(false)} 
            disabled={isPending}
          >
            {isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => handleSubmit(true)}
            disabled={isPending}
          >
            Save & Add Another
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
