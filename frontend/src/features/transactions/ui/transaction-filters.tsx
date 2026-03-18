'use client';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
import { CategorySelector } from '@/features/categories/ui/category-selector';
import { TagSelector } from '@/features/tags/ui/tag-selector';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { Period } from "@/features/periods/model/types";

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
  statusFilter: string;
  setStatusFilter: (v: any) => void;
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
  onApply: () => void;
  onReset: () => void;
  t: any;
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
  statusFilter,
  setStatusFilter,
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
  onApply,
  onReset,
  t
}: TransactionFiltersProps) {
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
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 rounded-full border-2 border-background text-[10px]">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {isFilterOpen && (
        <div className="p-4 rounded-xl border bg-muted/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">{t('fields.category')}</label>
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
              <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">Tags</label>
              {activeAccountId && (
                <TagSelector 
                  accountId={activeAccountId} 
                  selectedTagIds={selectedTagIds} 
                  onChange={setSelectedTagIds}
                />
              )}
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">{t('filter_status')}</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'reconciled' | 'not_reconciled')}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue>
                    {statusFilter === 'all' ? t('status_all') : statusFilter === 'reconciled' ? t('status_reconciled') : t('status_not_reconciled')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('status_all')}</SelectItem>
                  <SelectItem value="reconciled">{t('status_reconciled')}</SelectItem>
                  <SelectItem value="not_reconciled">{t('status_not_reconciled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount Range */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">{t('amount_range')}</label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  placeholder="Min" 
                  className="h-10 bg-background" 
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
                <span className="text-muted-foreground">-</span>
                <Input 
                  type="number" 
                  placeholder="Max" 
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
                  <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">{t('date_range')}</label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="date" 
                      className="h-10 bg-background" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <span className="text-muted-foreground text-xs">au</span>
                    <Input 
                      type="date" 
                      className="h-10 bg-background" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">{t('budget_period')}</label>
                  <Select value={effectivePeriodId} onValueChange={(v) => setSelectedPeriodId(v || 'all')}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue>
                        {effectivePeriodId === 'all' 
                          ? t('all_periods') 
                          : (function() {
                              const p = periods?.find(p => p.id === effectivePeriodId);
                              return p ? `${format(new Date(p.startDate), 'dd/MM/yy')} - ${format(new Date(p.endDate), 'dd/MM/yy')}` : t('budget_period');
                            })()
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_periods')}</SelectItem>
                      {periods?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {format(new Date(p.startDate), 'dd/MM/yyyy')} - {format(new Date(p.endDate), 'dd/MM/yyyy')} {p.isActive && "(Active)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          
          <div className="flex justify-end items-center gap-2 pt-2 border-t border-border/50">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 text-[10px] font-bold uppercase tracking-wider gap-2 hover:bg-destructive/10 hover:text-destructive" 
              onClick={onReset}
            >
              <X className="w-3 h-3" />
              {t('reset_filters')}
            </Button>
            <Button 
              size="sm" 
              className="h-9 text-[10px] font-bold uppercase tracking-wider gap-2 px-6" 
              onClick={onApply}
            >
              <Filter className="w-3 h-3" />
              Appliquer les filtres
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
