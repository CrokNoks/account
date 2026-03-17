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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { useTags } from '@/features/tags/api/use-tags';
import { useCreateSmartRule } from '../api/use-smart-rules';
import { Plus, Sparkles, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";

export function CreateSmartRuleDialog() {
  const t = useTranslations('SmartRules');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [priority, setPriority] = useState('0');

  const { data: categories } = useCategories(activeAccountId);
  const { data: tags } = useTags(activeAccountId);
  const { mutate: createRule, isPending } = useCreateSmartRule();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId || !pattern) return;

    createRule({
      accountId: activeAccountId,
      data: {
        pattern,
        categoryId: categoryId === 'none' ? null : categoryId,
        tagIds: selectedTagIds,
        priority: parseInt(priority, 10),
      }
    }, {
      onSuccess: () => {
        setOpen(false);
        setPattern('');
        setCategoryId(null);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button className="gap-2 px-4 shadow-lg shadow-primary/20" type="button" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>{t('add_rule')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl!">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 bg-primary/5 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <DialogTitle className="text-xl font-bold">{t('new_rule_title')}</DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
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
                <Select value={categoryId || 'none'} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={t('no_category')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_category')}</SelectItem>
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

          <DialogFooter className="p-6 pt-0">
            <Button 
              type="submit" 
              className="w-full h-11 text-base font-bold shadow-lg shadow-primary/20" 
              disabled={isPending || !pattern}
            >
              {isPending ? tc('loading') : t('create_confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
