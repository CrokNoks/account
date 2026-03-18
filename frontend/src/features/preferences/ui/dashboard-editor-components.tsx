'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Monitor, Smartphone, X, GripVertical } from 'lucide-react';
import { cn } from "@/lib/utils";

export function MiniWidget({ 
  id, label, width, desktopVisible, mobileVisible, onRemove, onWidthChange, onToggleDevice 
}: { 
  id: string, label: string, width: number, desktopVisible: boolean, mobileVisible: boolean,
  onRemove: () => void, onWidthChange: (width: number) => void, onToggleDevice: (device: 'mobile' | 'desktop') => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 0 };

  const toggleWidth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const widths = [2, 3, 4, 6, 12];
    const currentIndex = widths.indexOf(width);
    const nextWidth = widths[(currentIndex + 1) % widths.length];
    onWidthChange(nextWidth);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-grab active:cursor-grabbing min-h-[120px]",
        width === 2 && "col-span-12 lg:col-span-2",
        width === 3 && "col-span-12 lg:col-span-3",
        width === 4 && "col-span-12 lg:col-span-4",
        width === 6 && "col-span-12 lg:col-span-6",
        width === 12 && "col-span-12",
        "bg-primary/5 border-primary/20 hover:border-primary/50 text-foreground shadow-sm",
        isDragging && "opacity-50 scale-105 z-50 shadow-xl",
        (!desktopVisible || !mobileVisible) && "opacity-60"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <button onPointerDown={(e) => { e.stopPropagation(); onToggleDevice('desktop'); }} className={cn("p-1.5 rounded-full hover:bg-background/80 transition-colors", desktopVisible ? "text-primary" : "text-muted-foreground")} title={desktopVisible ? "Masquer sur Desktop" : "Afficher sur Desktop"}>
          <Monitor className="w-3.5 h-3.5" />
        </button>
        <button onPointerDown={(e) => { e.stopPropagation(); onToggleDevice('mobile'); }} className={cn("p-1.5 rounded-full hover:bg-background/80 transition-colors", mobileVisible ? "text-primary" : "text-muted-foreground")} title={mobileVisible ? "Masquer sur Mobile" : "Afficher sur Mobile"}>
          <Smartphone className="w-3.5 h-3.5" />
        </button>
        <button onPointerDown={(e) => { e.stopPropagation(); onRemove(); }} className="p-1.5 rounded-full text-destructive hover:bg-destructive/10 transition-colors" title="Supprimer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      
      <div className="flex flex-col items-center gap-2 mt-2">
        <GripVertical className="w-5 h-5 text-muted-foreground/30" />
        <span className="text-sm font-bold text-center px-2">{label}</span>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
        <button onPointerDown={(e) => { e.stopPropagation(); toggleWidth(e); }} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-background hover:bg-muted text-muted-foreground rounded-full border border-border/50 shadow-sm transition-colors">
          <div className="flex gap-0.5 items-center justify-center w-4 h-3">
            <div className={cn("bg-current rounded-full transition-all", width === 2 ? "w-1 h-1" : width === 3 ? "w-1.5 h-1.5" : width === 4 ? "w-2 h-1.5" : width === 6 ? "w-3 h-1.5" : "w-4 h-1.5")} />
          </div>
          {width}/12
        </button>
      </div>
    </div>
  );
}

export function ManagementItem({ id, label, onAdd, onRemove, isActive = false }: { id: string, label: string, onAdd?: () => void, onRemove?: () => void, isActive?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 0 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all",
        isActive 
          ? "bg-primary text-primary-foreground border-primary shadow-sm cursor-grab active:cursor-grabbing" 
          : "bg-background text-muted-foreground border-dashed border-muted-foreground/30 hover:border-primary hover:text-primary cursor-pointer",
        isDragging && "opacity-50 scale-95"
      )}
      onClick={!isActive ? onAdd : undefined}
      {...(isActive ? attributes : {})}
      {...(isActive ? listeners : {})}
    >
      {isActive && <GripVertical className="w-3 h-3 opacity-50" />}
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
      {isActive && (
        <button onClick={(e) => { e.stopPropagation(); onRemove?.(); }} className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function SortableWidget({ 
  children, desktopVisible, mobileVisible, width, 
}: { 
  id: string, children: React.ReactNode, isEditing: boolean, width: number,
  desktopVisible: boolean, mobileVisible: boolean, onWidthChange: (width: number) => void,
  onToggleDevice: (device: 'mobile' | 'desktop') => void
}) {
  if (!children) return null;

  return (
    <div 
      className={cn(
        "relative col-span-12 max-h-[80vh] flex flex-col",
        !desktopVisible && "lg:hidden",
        !mobileVisible && "hidden lg:flex",
        width === 2 && "lg:col-span-2",
        width === 3 && "lg:col-span-3",
        width === 4 && "lg:col-span-4",
        width === 6 && "lg:col-span-6",
        width === 12 && "lg:col-span-12"
      )}
    >
      {children}
    </div>
  );
}
