'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useCategories, Category } from '../api/use-categories';
import { useUpdateCategory } from '../api/use-update-category';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { formatCurrency } from '@/shared/lib/format';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from 'lucide-react';
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

export function CategoryList() {
  const { activeAccountId } = useAccountStore();
  const { data: categories, isLoading } = useCategories(activeAccountId);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  if (isLoading) return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
      ))}
    </div>
  );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories?.map((category) => (
          <Card key={category.id} className="group hover:border-primary/50 transition-colors relative">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: category.color }} 
                />
                {category.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon-sm" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  onClick={() => setEditingCategory(category)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Badge variant="secondary" className="text-[10px] capitalize">{category.type}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Template: {(category as any).budget ? formatCurrency((category as any).budget) : "No default budget"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingCategory && (
        <EditCategoryDialog 
          category={editingCategory} 
          open={!!editingCategory} 
          onOpenChange={(o) => !o && setEditingCategory(null)} 
        />
      )}
    </>
  );
}

function EditCategoryDialog({ category, open, onOpenChange }: { category: Category, open: boolean, onOpenChange: (o: boolean) => void }) {
  const { activeAccountId } = useAccountStore();
  const [name, setName] = useState(category.name);
  const [type, setType] = useState(category.type);
  const [color, setColor] = useState(category.color);
  const [budget, setBudget] = useState((parseInt((category as any).budget || '0', 10) / 100).toString());
  
  const { mutate: updateCategory, isPending } = useUpdateCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    updateCategory({
      accountId: activeAccountId,
      id: category.id,
      data: {
        name,
        type,
        color,
        budget: (parseFloat(budget) * 100).toString(),
      }
    }, {
      onSuccess: () => {
        toast.success(`Category "${name}" updated`);
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={(v) => setType(v || 'expense')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 p-1 h-10" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Budget</label>
            <Input type="number" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Updating...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
