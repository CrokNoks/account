'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUiStore, TourName } from '@/shared/model/use-ui-store';
import { cn } from '@/lib/utils';

interface HelpButtonProps {
  tour: TourName;
  stepIndex?: number;
  className?: string;
  title?: string;
}

export function HelpButton({ 
  tour, 
  stepIndex, 
  className, 
  title = "Aide contextuelle" 
}: HelpButtonProps) {
  const startTour = useUiStore((state) => state.startTour);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTour(tour, stepIndex);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-6 w-6 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors",
        className
      )}
      onClick={handleClick}
      title={title}
    >
      <HelpCircle className="w-4 h-4" />
    </Button>
  );
}
