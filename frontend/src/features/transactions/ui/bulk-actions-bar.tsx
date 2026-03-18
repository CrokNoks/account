'use client';

import { Button } from "@/components/ui/button";
import { CheckCircle2, Trash2, X } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkReconcile: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkReconcile
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-4 border border-primary-foreground/20 ring-4 ring-primary/10">
        <div className="flex items-center gap-2 px-2 border-r border-primary-foreground/20 mr-2">
          <span className="text-sm font-black tabular-nums">{selectedCount}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Sélectionnés</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary-foreground hover:bg-primary-foreground/10 gap-2 h-9 px-3"
            onClick={onBulkDelete}
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-bold text-red-200">Supprimer</span>
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary-foreground hover:bg-primary-foreground/10 gap-2 h-9 px-3"
            onClick={onBulkReconcile}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-bold">Pointer</span>
          </Button>

          <div className="w-px h-6 bg-primary-foreground/20 mx-2" />

          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary-foreground hover:bg-primary-foreground/10 h-9 w-9 p-0"
            onClick={onClearSelection}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
