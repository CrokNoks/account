'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
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
import { useCreateCategory } from '../api/use-create-category';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export function CreateCategoryDialog() {
  const { activeAccountId } = useAccountStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3498db');
  const [type, setType] = useState('expense');
  const [budget, setBudget] = useState('0');
  
  const { mutate: createCategory, isPending } = useCreateCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    createCategory({
      accountId: activeAccountId,
      name,
      color,
      type,
      budget: (parseFloat(budget) * 100).toString(),
    }, {
      onSuccess: () => {
        toast.success(`Category "${name}" created`);
        setOpen(false);
        setName('');
        setBudget('0');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger >
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
          <DialogDescription>
            Create a category to organize your transactions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input 
              placeholder="Rent, Food, Salary..." 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={(v) => setType(v || 'expense')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2">
                <Input 
                  type="color" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 p-1 h-10"
                />
                <Input 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#hex"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Budget (Template)</label>
            <Input 
              type="number" 
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground italic">Suggested budget for new periods.</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
