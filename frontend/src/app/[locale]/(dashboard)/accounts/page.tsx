'use client';

import { AccountList } from "@/features/accounts/ui/account-list";
import { CreateAccountDialog } from "@/features/accounts/ui/create-account-dialog";
import { useTranslations } from 'next-intl';
import { useUiStore } from "@/shared/model/use-ui-store";
import { useEffect } from "react";
import { HelpButton } from "@/shared/ui/tour/HelpButton";

export default function AccountsPage() {
  const t = useTranslations('Accounts');
  const { startTour, completedTours } = useUiStore();

  useEffect(() => {
    if (!completedTours['account']) {
      const timer = setTimeout(() => {
        startTour('account');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedTours, startTour]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
            <HelpButton tour="account" className="h-8 w-8" />
          </div>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <CreateAccountDialog />
      </div>

      <AccountList />
    </div>
  );
}
