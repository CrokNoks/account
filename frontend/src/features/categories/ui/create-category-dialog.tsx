'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
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
import { CategoryType } from '@/features/categories/api/use-categories';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function CreateCategoryDialog() {
  const { activeAccountId } = useAccountStore();
  const t = useTranslations('Categories');
  const tc = useTranslations('Common');
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>(CategoryType.EXPENSE);
  const [color, setColor] = useState('#3b82f6');
  
  const { mutate: createCategory, isPending } = useCreateCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    createCategory({
      accountId: activeAccountId,
      name,
      type,
      color,
    }, {
      onSuccess: () => {
        setOpen(false);
        setName('');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t('add_category')}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('add_category')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.name')}</label>
            <Input 
              placeholder="Rent, Groceries..." 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.type')}</label>
            <Select value={type} onValueChange={(v) => setType(v as CategoryType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CategoryType.EXPENSE}>{t('types.expense')}</SelectItem>
                <SelectItem value={CategoryType.INCOME}>{t('types.income')}</SelectItem>
                <SelectItem value={CategoryType.TRANSFER}>{t('types.transfer')}</SelectItem>
                <SelectItem value={CategoryType.SAVINGS}>{t('types.savings')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.color')}</label>
            <div className="flex gap-2">
              <Input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? tc('loading') : tc('add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
