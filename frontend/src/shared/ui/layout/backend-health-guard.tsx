'use client';

import React from 'react';
import { useBackendHealth } from '@/shared/api/use-backend-health';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';

interface BackendHealthGuardProps {
  children: React.ReactNode;
}

export function BackendHealthGuard({ children }: BackendHealthGuardProps) {
  const { isLoading, isError, refetch } = useBackendHealth();
  const t = useTranslations('Common');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-background text-foreground space-y-6">
        <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-500">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium text-muted-foreground">{t('waking_up_backend')}</p>
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
