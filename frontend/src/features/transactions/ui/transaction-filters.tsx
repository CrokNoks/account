'use client';

import { Input } from "@/components/ui/input";
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
import { CategorySelector } from '@/features/categories/ui/category-selector';
import { TagSelector } from '@/features/tags/ui/tag-selector';
import { formatShortRange } from '@/shared/lib/date-only';
import { Period } from "@/features/periods/model/types";
import { useLocale, useTranslations } from "next-intl";
import { cn } from '@/lib/utils';
import type { StateFilter } from '../model/operation-state';

interface TransactionFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  isFilterOpen: boolean;
  setIsFilterOpen: (v: boolean) => void;
  activeFiltersCount: number;
  activeAccountId: string | null;
  selectedCategoryId: string;
  setSelectedCategoryId: (v: string) => void;
  selectedTagIds: string[];
  setSelectedTagIds: (v: string[]) => void;
  stateFilter: StateFilter;
  onStateChange: (v: StateFilter) => void;
  /** Reste à pointer de la période choisie (affiché dans « À pointer · N »). */
  toPointCount?: number;
  minAmount: string;
  setMinAmount: (v: string) => void;
  maxAmount: string;
  setMaxAmount: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  effectivePeriodId: string;
  setSelectedPeriodId: (v: string) => void;
  periods?: Period[];
  periodId?: string;
  /** La période est choisie ailleurs (sélecteur de l'écran) : pas de filtre de période ici. */
  periodControlled?: boolean;
  onApply: () => void;
  onReset: () => void;
  t: ReturnType<typeof useTranslations>;
}

export function TransactionFilters({
  search,
  setSearch,
  isFilterOpen,
  setIsFilterOpen,
  activeFiltersCount,
  activeAccountId,
  selectedCategoryId,
  setSelectedCategoryId,
  selectedTagIds,
  setSelectedTagIds,
  stateFilter,
  onStateChange,
  toPointCount,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  effectivePeriodId,
  setSelectedPeriodId,
  periods,
  periodId,
  periodControlled,
  onApply,
  onReset,
  t
}: TransactionFiltersProps) {
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-4 shrink-0">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={t('search_placeholder')} 
            className="pl-10 h-11" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApply();
            }}
          />
          {search && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
              onClick={() => { setSearch(''); onReset(); }}
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </Button>
          )}
        </div>
        <Button 
          variant={isFilterOpen ? "default" : "outline"}
          className="h-11 gap-2 relative px-4"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">{t('filter_title')}</span>
          {activeFiltersCount > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 rounded-full border-2 border-background text-[10px] max-lg:text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      <div role="group" aria-label={t('filter_status')} className="flex flex-wrap gap-2">
        {(['all', 'a_pointer', 'a_venir', 'pointee'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={stateFilter === value ? 'default' : 'outline'}
            aria-pressed={stateFilter === value}
            className={cn('h-8 text-xs font-bold')}
            onClick={() => onStateChange(value)}
          >
            {value === 'a_pointer' && toPointCount !== undefined
              ? t('status_a_pointer_count', { count: toPointCount })
              : t(`status_${value}`)}
          </Button>
        ))}
      </div>

      {isFilterOpen && (
        <div className="p-4 rounded-xl border bg-muted/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-[10px] max-lg:text-xs font-bold uppercase text-muted-foreground px-1">{t('fields.category')}</label>
              <CategorySelector 
                key={activeAccountId}
                accountId={activeAccountId}
                value={selectedCategoryId === 'all' ? '' : selectedCategoryId}
                onChange={(v) => setSelectedCategoryId(v || 'all')}
                placeholder={t('all_categories')}
                className="h-10 bg-background"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-[10px] max-lg:text-xs font-bold uppercase text-muted-foreground px-1">{t('filters.tags')}</label>
              {activeAccountId && (
                <TagSelector 
                  accountId={activeAccountId} 
                  selectedTagIds={selectedTagIds} 
                  onChange={setSelectedTagIds}
                />
              )}
            </div>

            {/* Amount Range */}
            <div className="space-y-1.5">
              <label className="text-[10px] max-lg:text-xs font-bold uppercase text-muted-foreground px-1">{t('amount_range')}</label>
              <div className="flex items-center gap-2">
                <AmountInput
                  placeholder={t('filters.min')} 
                  className="h-10 bg-background" 
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
                <span className="text-muted-foreground">-</span>
                <AmountInput
                  placeholder={t('filters.max')} 
                  className="h-10 bg-background" 
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Date Range & Period (Full width row) */}
            {!periodId && (
              <>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] max-lg:text-xs font-bold uppercase text-muted-foreground px-1">{t('date_range')}</label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="date" 
                      className="h-10 bg-background" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <span className="text-muted-foreground text-xs">{t('filters.date_to')}</span>
                    <Input 
                      type="date" 
                      className="h-10 bg-background" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {!periodControlled && (
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] max-lg:text-xs font-bold uppercase text-muted-foreground px-1">{t('budget_period')}</label>
                  <Select value={effectivePeriodId} onValueChange={(v) => setSelectedPeriodId(v || 'all')}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue>
                        {effectivePeriodId === 'all' 
                          ? t('all_periods') 
                          : (function() {
                              const p = periods?.find(p => p.id === effectivePeriodId);
                              return p ? formatShortRange(p.startDate, p.endDate, locale) : t('budget_period');
                            })()
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_periods')}</SelectItem>
                      {periods?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {formatShortRange(p.startDate, p.endDate, locale)} {p.isActive && t('filters.active_suffix')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                )}
              </>
            )}
          </div>
          
          <div className="flex justify-end items-center gap-2 pt-2 border-t border-border/50">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 text-[10px] max-lg:text-xs font-bold uppercase tracking-wider gap-2 hover:bg-destructive/10 hover:text-destructive" 
              onClick={onReset}
            >
              <X className="w-3 h-3" />
              {t('reset_filters')}
            </Button>
            <Button 
              size="sm" 
              className="h-9 text-[10px] max-lg:text-xs font-bold uppercase tracking-wider gap-2 px-6" 
              onClick={onApply}
            >
              <Filter className="w-3 h-3" />
              {t('filters.apply')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
