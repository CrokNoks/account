'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          {t('add_tag')}
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('add_tag')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.name')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Voyages, Santé, Cadeaux..." required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.color')}</label>
            <div className="flex gap-2">
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 p-1 h-10" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
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
