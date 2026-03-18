'use client';

import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { CategoryType } from '@/features/categories/model/types';
import { useCategories } from '@/features/categories/api/use-categories';
import { cn } from "@/lib/utils";
import { useTranslations } from 'next-intl';

interface CategorySelectorProps {
  accountId: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CategorySelector({
  accountId,
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: CategorySelectorProps) {
  const t = useTranslations('Categories');
  const { data: categories, isLoading } = useCategories(accountId);

  const selectedCategory = categories?.find((c) => c.id === value);

  return (
    <Select 
      value={value || "none"} 
      onValueChange={(v) => onChange(v === 'none' ? '' : (v || ''))}
      disabled={disabled || isLoading || !accountId}
    >
      <SelectTrigger className={cn("w-full h-11 justify-between", className)}>
        <SelectValue placeholder={placeholder || "Sélectionner une catégorie..."}>
          {selectedCategory ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedCategory.color }} />
              <span className="truncate">{selectedCategory.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder || "Sélectionner une catégorie..."}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="italic text-muted-foreground">Sans catégorie</span>
        </SelectItem>
        {categories && categories.length > 0 ? (
          categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="truncate">{cat.name}</span>
              </div>
            </SelectItem>
          ))
        ) : !isLoading && (
          <div className="p-2 text-xs text-center text-muted-foreground">
            Aucune catégorie trouvée
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
