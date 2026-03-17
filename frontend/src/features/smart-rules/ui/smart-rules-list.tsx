'use client';

import { useSmartRules, useDeleteSmartRule } from '../api/use-smart-rules';
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
import { Trash2, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function SmartRulesList() {
  const t = useTranslations('SmartRules');
  const { activeAccountId } = useAccountStore();
  const { data: rules, isLoading } = useSmartRules(activeAccountId);
  const { data: categories } = useCategories(activeAccountId);
  const { data: tags } = useTags(activeAccountId);
  const { mutate: deleteRule } = useDeleteSmartRule();

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  const handleDelete = (id: string) => {
    if (!activeAccountId || !confirm(t('delete_confirm'))) return;
    deleteRule({ accountId: activeAccountId, id }, {
      onSuccess: () => toast.success(t('deleted'))
    });
  };

  return (
    <div className="bg-card rounded-2xl border-2 shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>{t('fields.pattern')}</TableHead>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>{t('fields.result')}</TableHead>
            <TableHead className="text-center w-[100px]">{t('fields.priority')}</TableHead>
            <TableHead className="w-[80px]"></TableHead>
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
