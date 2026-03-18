'use client';

import { useState } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter,
  SheetTrigger
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateTag } from '../api/use-create-tag';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function CreateTagDialog() {
  const t = useTranslations('Tags');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#94a3b8');
  
  const { mutate: createTag, isPending } = useCreateTag();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    createTag({
      accountId: activeAccountId,
      name,
      color,
    }, {
      onSuccess: () => {
        toast.success(tc('success'));
        setName('');
        setOpen(false);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          {t('add_tag')}
        </Button>
      } />
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>{t('add_tag')}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fields.name')}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Voyages, Santé, Cadeaux..." required className="h-11" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fields.color')}</label>
              <div className="flex gap-2">
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 p-1 h-11" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-11" />
              </div>
            </div>
          </div>
          <SheetFooter className="p-6 border-t bg-muted/20">
            <Button type="submit" disabled={isPending} className="w-full h-11 text-base font-semibold">
              {isPending ? tc('loading') : tc('save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
