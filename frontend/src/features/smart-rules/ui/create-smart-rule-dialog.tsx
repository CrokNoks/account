'use client';

import { useState } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useTags } from '@/features/tags/api/use-tags';
import { useCreateSmartRule } from '../api/use-smart-rules';
import { Plus, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { CategorySelector } from '@/features/categories/ui/category-selector';

export function CreateSmartRuleDialog() {
  const t = useTranslations('SmartRules');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [priority, setPriority] = useState('0');

  const { data: tags } = useTags(activeAccountId);
  const { mutate: createRule, isPending } = useCreateSmartRule();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId || !pattern) return;

    createRule({
      accountId: activeAccountId,
      data: {
        pattern,
        categoryId: categoryId || null,
        tagIds: selectedTagIds,
        priority: parseInt(priority, 10),
      }
    }, {
      onSuccess: () => {
        setOpen(false);
        setPattern('');
        setCategoryId('');
        setSelectedTagIds([]);
        setPriority('0');
      }
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button className="gap-2 px-4 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" />
            <span>{t('add_rule')}</span>
          </Button>
        }
      />
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <SheetTitle className="text-xl font-bold">{t('new_rule_title')}</SheetTitle>
          </div>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('fields.pattern')}</label>
              <Input 
                placeholder="Ex: NETFLIX, TOTAL, AMZN..." 
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="h-11 font-medium"
                required
              />
              <p className="text-[10px] text-muted-foreground italic">
                La règle sera appliquée si la description contient ce texte.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('fields.category')}</label>
                <CategorySelector 
                  key={activeAccountId}
                  accountId={activeAccountId}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('fields.priority')}</label>
                <Input 
                  type="number" 
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('fields.tags')}</label>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-xl border border-dashed">
                {tags?.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">Aucun tag disponible</p>
                ) : (
                  tags?.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                      className="cursor-pointer transition-all hover:scale-105 h-7 px-3"
                      onClick={() => toggleTag(tag.id)}
                      style={!selectedTagIds.includes(tag.id) ? { 
                        borderColor: `${tag.color}40`,
                        color: tag.color
                      } : {
                        backgroundColor: tag.color
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          <SheetFooter className="p-6 border-t bg-muted/20">
            <Button 
              type="submit" 
              className="w-full h-11 text-base font-bold shadow-lg shadow-primary/20" 
              disabled={isPending || !pattern}
            >
              {isPending ? tc('loading') : t('create_confirm')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
