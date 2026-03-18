'use client';

import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useCategories, CategoryType } from '@/features/categories/api/use-categories';
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
      value={value} 
      onValueChange={(v) => onChange(v === 'none' ? '' : (v || ''))}
      disabled={disabled || isLoading || !accountId}
    >
      <SelectTrigger className={cn("w-full h-11", className)}>
        <SelectValue placeholder={placeholder || "Sélectionner une catégorie..."}>
          {value ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedCategory?.color }} />
              {selectedCategory?.name}
            </div>
          ) : (
            placeholder || "Sélectionner une catégorie..."
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sans catégorie</SelectItem>
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
  );
}
