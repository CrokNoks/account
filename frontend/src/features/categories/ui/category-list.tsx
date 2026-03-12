'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useCategories, Category, CategoryType } from '../api/use-categories';
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
import { useTranslations } from 'next-intl';

export function CategoryList() {
  const t = useTranslations('Categories');
  const { activeAccountId } = useAccountStore();
  const { data: categories, isLoading } = useCategories(activeAccountId);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  if (isLoading) return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
      ))}
    </div>
  );

  const groupedCategories = categories?.reduce((acc, cat) => {
    if (!acc[cat.type]) acc[cat.type] = [];
    acc[cat.type].push(cat);
    return acc;
  }, {} as Record<string, Category[]>) || {};

  // Sort categories by name within each group
  Object.keys(groupedCategories).forEach(type => {
    groupedCategories[type].sort((a, b) => a.name.localeCompare(b.name));
  });

  const order = [CategoryType.EXPENSE, CategoryType.INCOME, CategoryType.SAVINGS, CategoryType.TRANSFER];

  return (
    <>
      <div className="space-y-8">
        {order.map((type) => {
          const group = groupedCategories[type];
          if (!group || group.length === 0) return null;

          const bgColors: Record<string, string> = {
            expense: "bg-red-100/80 dark:bg-red-900/30 border-red-200 dark:border-red-800",
            income: "bg-green-100/80 dark:bg-green-900/30 border-green-200 dark:border-green-800",
            savings: "bg-blue-100/80 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
            transfer: "bg-slate-200/80 dark:bg-slate-800/30 border-slate-300 dark:border-slate-700",
          };

          return (
            <div key={type} className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 px-1">
                <span className="capitalize">{t(`types.${type}`)}</span>
                <Badge variant="secondary" className="rounded-full h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                  {group.length}
                </Badge>
              </h3>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {group.map((category) => (
                  <Card key={category.id} className={`group hover:border-primary transition-all relative border-2 ${bgColors[category.type] || ""}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 truncate pr-8">
                        <div 
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-black/10" 
                          style={{ backgroundColor: category.color }} 
                        />
                        <span className="truncate">{category.name}</span>
                      </CardTitle>
                      <div className="flex items-center gap-1 absolute right-2 top-2">
                        <Button 
                          variant="ghost" 
                          size="icon-sm" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 hover:bg-background/50"
                          onClick={() => setEditingCategory(category)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground/80">
                          {formatCurrency('0')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
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
  const t = useTranslations('Categories');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const [name, setName] = useState(category.name);
  const [type, setType] = useState(category.type);
  const [color, setColor] = useState(category.color);
  const [budget, setBudget] = useState('0');
  
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
      }
    }, {
      onSuccess: () => {
        toast.success(tc('success'));
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
            <label className="text-sm font-medium">{t('fields.name')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fields.type')}</label>
              <Select value={type} onValueChange={(v) => setType(v as CategoryType || CategoryType.EXPENSE)}>
                <SelectTrigger>
                  <SelectValue>
                    {type === CategoryType.EXPENSE && t('types.expense')}
                    {type === CategoryType.INCOME && t('types.income')}
                    {type === CategoryType.SAVINGS && t('types.savings')}
                    {type === CategoryType.TRANSFER && t('types.transfer')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CategoryType.EXPENSE}>{t('types.expense')}</SelectItem>
                  <SelectItem value={CategoryType.INCOME}>{t('types.income')}</SelectItem>
                  <SelectItem value={CategoryType.SAVINGS}>{t('types.savings')}</SelectItem>
                  <SelectItem value={CategoryType.TRANSFER}>{t('types.transfer')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fields.color')}</label>
              <div className="flex gap-2">
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 p-1 h-10" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Budget</label>
            <Input type="number" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? tc('loading') : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
