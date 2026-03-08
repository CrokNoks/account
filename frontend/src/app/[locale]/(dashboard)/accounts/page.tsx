'use client';

import { AccountList } from "@/features/accounts/ui/account-list";
import { CreateAccountDialog } from "@/features/accounts/ui/create-account-dialog";
import { useTranslations } from 'next-intl';

export default function AccountsPage() {
  const t = useTranslations('Accounts');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
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
