'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useTags, Tag } from '../api/use-tags';
import { useUpdateTag } from '../api/use-update-tag';
import { useDeleteTag } from '../api/use-delete-tag';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useUiStore } from '@/shared/model/use-ui-store';
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function TagList() {
  const t = useTranslations('Tags');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const setTagDetailId = useUiStore((state) => state.setTagDetailId);
  const { data: tags, isLoading } = useTags(activeAccountId);
  const { mutate: deleteTag } = useDeleteTag();
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  if (isLoading) return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
      ))}
    </div>
  );

  const handleDelete = (tagId: string) => {
    if (!activeAccountId || !confirm(t('delete_confirm'))) return;
    deleteTag({ accountId: activeAccountId, id: tagId }, {
      onSuccess: () => toast.success(tc('success'))
    });
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {tags?.map((tag) => (
          <Card 
            key={tag.id} 
            className="group hover:border-primary transition-all relative border-2 cursor-pointer"
            onClick={() => setTagDetailId(tag.id)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-bold flex items-center gap-2 truncate pr-16">
                <div 
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-black/10" 
                  style={{ backgroundColor: tag.color || '#94a3b8' }} 
                />
                <span className="truncate">{tag.name}</span>
              </CardTitle>
              <div className="flex items-center gap-1 absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="ghost" 
                  size="icon-xs" 
                  className="h-6 w-6 hover:bg-background/50"
                  onClick={() => setEditingTag(tag)}
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon-xs" 
                  className="h-6 w-6 hover:bg-background/50 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(tag.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
        {tags?.length === 0 && (
          <div className="col-span-full p-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            {t('empty')}
          </div>
        )}
      </div>

      {editingTag && (
        <EditTagDialog 
          tag={editingTag} 
          open={!!editingTag} 
          onOpenChange={(o) => !o && setEditingTag(null)} 
        />
      )}
    </>
  );
}

function EditTagDialog({ tag, open, onOpenChange }: { tag: Tag, open: boolean, onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('Tags');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color || '#94a3b8');
  
  const { mutate: updateTag, isPending } = useUpdateTag();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    updateTag({
      accountId: activeAccountId,
      id: tag.id,
      name,
      color,
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
          <DialogTitle>{tc('edit')} Tag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.name')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
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
