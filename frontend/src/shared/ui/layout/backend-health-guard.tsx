'use client';

import React from 'react';
import { useBackendHealth } from '@/shared/api/use-backend-health';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PiggyBank, AlertCircle } from 'lucide-react';

interface BackendHealthGuardProps {
  children: React.ReactNode;
}

export function BackendHealthGuard({ children }: BackendHealthGuardProps) {
  const { isLoading, isError, refetch } = useBackendHealth();
  const t = useTranslations('Common');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-background text-foreground space-y-6">
        <style jsx global>{`
          @keyframes draw {
            0% { stroke-dashoffset: 100; }
            50% { stroke-dashoffset: 0; }
            80% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          .animate-draw path {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: draw 3s infinite ease-in-out;
          }
          .animate-draw path:nth-child(2) { animation-delay: 0.5s; }
          .animate-draw path:nth-child(3) { animation-delay: 0.8s; }
        `}</style>
        <div className="flex flex-col items-center space-y-12 animate-in fade-in duration-700">
          <div className="text-primary animate-draw">
            <PiggyBank size={192} strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground/60">
            {t('loading')}
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-background text-foreground space-y-6 p-4">
        <div className="flex flex-col items-center space-y-4 max-w-md text-center animate-in fade-in zoom-in duration-300">
          <AlertCircle className="h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-bold">{t('backend_unavailable')}</h2>
          <p className="text-muted-foreground">
            {t('backend_error_desc')}
          </p>
          <Button onClick={() => refetch()} size="lg" className="mt-4">
            {t('retry')}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
