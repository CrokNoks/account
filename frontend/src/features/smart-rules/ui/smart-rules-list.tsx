'use client';

import { useSmartRules, useDeleteSmartRule, useUpdateSmartRule } from '../api/use-smart-rules';
import { SmartRule } from '../model/types';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { useTags } from '@/features/tags/api/use-tags';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Sparkles, ArrowRight, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter 
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { CategorySelector } from '@/features/categories/ui/category-selector';

export function SmartRulesList() {
  const t = useTranslations('SmartRules');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { data: rules, isLoading } = useSmartRules(activeAccountId);
  const { data: categories } = useCategories(activeAccountId);
  const { data: tags } = useTags(activeAccountId);
  const { mutate: deleteRule } = useDeleteSmartRule();
  const [editingRule, setEditingRule] = useState<SmartRule | null>(null);

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  const handleDelete = (id: string) => {
    if (!activeAccountId || !confirm(t('delete_confirm'))) return;
    deleteRule({ accountId: activeAccountId, id }, {
      onSuccess: () => toast.success(t('deleted'))
    });
  };

  return (
    <>
      <div className="bg-card rounded-2xl border-2 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t('fields.pattern')}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>{t('fields.result')}</TableHead>
              <TableHead className="text-center w-[100px]">{t('fields.priority')}</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rules || rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => {
                const category = categories?.find(c => c.id === rule.categoryId);
                return (
                  <TableRow key={rule.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-primary/5 text-primary rounded font-bold text-xs border border-primary/10">
                          {rule.pattern}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {category ? (
                          <Badge variant="outline" className="h-6" style={{ borderColor: category.color, color: category.color }}>
                            {category.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">{t('no_category')}</span>
                        )}
                        
                        {rule.tagIds?.map(tagId => {
                          const tag = tags?.find(t => t.id === tagId);
                          return (
                            <Badge 
                              key={tagId} 
                              variant="secondary" 
                              className="h-6"
                              style={{ backgroundColor: `${tag?.color}20`, color: tag?.color }}
                            >
                              {tag?.name || 'Tag'}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground">
                      {rule.priority}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon-xs" 
                          className="h-8 w-8"
                          onClick={() => setEditingRule(rule)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon-xs" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {editingRule && (
        <EditSmartRuleSheet 
          rule={editingRule} 
          open={!!editingRule} 
          onOpenChange={(o) => !o && setEditingRule(null)} 
        />
      )}
    </>
  );
}

function EditSmartRuleSheet({ rule, open, onOpenChange }: { rule: SmartRule, open: boolean, onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('SmartRules');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const [pattern, setPattern] = useState(rule.pattern);
  const [categoryId, setCategoryId] = useState<string>(rule.categoryId || '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(rule.tagIds || []);
  const [priority, setPriority] = useState(rule.priority.toString());

  const { data: tags } = useTags(activeAccountId);
  const { mutate: updateRule, isPending } = useUpdateSmartRule();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId || !pattern) return;

    updateRule({
      accountId: activeAccountId,
      id: rule.id,
      data: {
        pattern,
        categoryId: categoryId || null,
        tagIds: selectedTagIds,
        priority: parseInt(priority, 10),
      }
    }, {
      onSuccess: () => {
        toast.success(tc('success'));
        onOpenChange(false);
      }
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <SheetTitle className="text-xl font-bold">{tc('edit')} Règle</SheetTitle>
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
              {isPending ? tc('loading') : tc('save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
