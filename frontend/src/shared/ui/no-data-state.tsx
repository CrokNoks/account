'use client';

import { LucideIcon, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoDataStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function NoDataState({ 
  icon: Icon = Database, 
  title, 
  description, 
  className 
}: NoDataStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 text-center gap-3 animate-in fade-in zoom-in duration-300",
      className
    )}>
      <div className="p-4 rounded-full bg-muted/30 text-muted-foreground/40">
        <Icon className="w-8 h-8" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">
          {title}
        </h3>
        {description && (
          <p className="text-[10px] text-muted-foreground/40 font-medium italic">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
