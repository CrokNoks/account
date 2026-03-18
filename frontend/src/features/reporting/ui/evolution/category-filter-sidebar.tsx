'use client';

import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/shared/lib/format";
import { Category } from "@/features/categories/model/types";

interface CategoryFilterSidebarProps {
  categories: (Category & { variance?: number })[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  isAllSelected: boolean;
}

export function CategoryFilterSidebar({
  categories,
  selectedIds,
  onToggle,
  onToggleAll,
  isAllSelected
}: CategoryFilterSidebarProps) {
  return (
    <div className="w-full md:w-64 space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <span className="text-sm font-semibold">Filtres</span>
        <button 
          onClick={onToggleAll}
          className="text-[10px] text-primary hover:underline font-medium"
        >
          {isAllSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center space-x-2">
            <Checkbox 
              id={`cat-${cat.id}`} 
              checked={selectedIds.has(cat.id)}
              onCheckedChange={() => onToggle(cat.id)}
            />
            <label 
              htmlFor={`cat-${cat.id}`}
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center justify-between gap-2 cursor-pointer truncate flex-1"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="truncate">{cat.name}</span>
              </div>
              <span className="text-[9px] text-muted-foreground shrink-0 font-mono">
                ±{formatCurrency((cat.variance || 0).toString())}
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
