'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCategories } from '@/features/categories/api/use-categories';
import { cn } from "@/lib/utils";
import { useTranslations } from 'next-intl';

type Category = NonNullable<ReturnType<typeof useCategories>['data']>[number];

interface CategorySelectorProps {
  accountId: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Restrict the list to these category types (all types when omitted). */
  types?: readonly Category['type'][];
  'aria-label'?: string;
}

const NONE = 'none';
const EMPTY: readonly never[] = [];

// Lowercase and strip accents, so "ele" matches "Électricité".
function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

interface SortedEntry {
  category: Category;
  key: string;
}

// Sorted once per categories array (react-query keeps the same reference), shared by all selectors.
const sortedCache = new WeakMap<readonly Category[], SortedEntry[]>();

function getSorted(categories: readonly Category[]): SortedEntry[] {
  let sorted = sortedCache.get(categories);
  if (!sorted) {
    sorted = categories
      .map((category) => ({ category, key: normalize(category.name) }))
      .sort((a, b) => a.key.localeCompare(b.key, 'fr'));
    sortedCache.set(categories, sorted);
  }
  return sorted;
}

export function CategorySelector({
  accountId,
  value,
  onChange,
  placeholder,
  className,
  disabled,
  types,
  'aria-label': ariaLabel,
}: CategorySelectorProps) {
  const t = useTranslations('Categories');
  const { data: categories, isLoading } = useCategories(accountId);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selectedCategory = categories?.find((c) => c.id === value);

  const visibleCategories = React.useMemo(() => {
    const query = normalize(search.trim());
    return getSorted(categories ?? EMPTY)
      .filter((e) => !types || types.includes(e.category.type))
      .filter((e) => !query || e.key.includes(query))
      .map((e) => e.category);
  }, [categories, search, types]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setSearch('');
  };

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const label = placeholder || t('selector.placeholder');

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            disabled={disabled || isLoading || !accountId}
            className={cn("w-full h-11 justify-between font-normal", className)}
          >
            {selectedCategory ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedCategory.color }} />
                <span className="truncate">{selectedCategory.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground truncate">{label}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-(--anchor-width) min-w-56 p-0" align="start">
        {/* Filtering and sorting are done here (by id), not by cmdk on the item value. */}
        <Command shouldFilter={false} label={t('selector.search_label')}>
          <CommandInput
            placeholder={t('selector.search_placeholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {visibleCategories.length === 0 && !isLoading && (
              <CommandEmpty>{t('selector.empty')}</CommandEmpty>
            )}
            <CommandGroup>
              {!search.trim() && (
                <CommandItem value={NONE} onSelect={() => choose('')}>
                  <Check className={cn("mr-2 h-4 w-4", !selectedCategory ? "opacity-100" : "opacity-0")} />
                  <span className="italic text-muted-foreground">{t('selector.none')}</span>
                </CommandItem>
              )}
              {visibleCategories.map((cat) => (
                <CommandItem key={cat.id} value={cat.id} onSelect={() => choose(cat.id)}>
                  <Check className={cn("mr-2 h-4 w-4", cat.id === value ? "opacity-100" : "opacity-0")} />
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="truncate">{cat.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
