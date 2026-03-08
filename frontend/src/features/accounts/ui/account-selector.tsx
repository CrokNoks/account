'use client';

import { useEffect } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAccounts } from '../api/use-accounts';
import { useAccountStore } from '../model/use-account-store';
import { useTranslations } from 'next-intl';

export function AccountSelector() {
  const t = useTranslations('Accounts');
  const { data: accounts, isLoading } = useAccounts();
  const { activeAccountId, setActiveAccountId } = useAccountStore();

  useEffect(() => {
    // Auto-select first account if none selected
    if (accounts && accounts.length > 0 && !activeAccountId) {
      setActiveAccountId(accounts[0].id);
    }
  }, [accounts, activeAccountId, setActiveAccountId]);

  if (isLoading) return <div className="h-10 w-[180px] bg-muted animate-pulse rounded-md" />;

  return (
    <Select 
      value={activeAccountId || ""} 
      onValueChange={(v) => setActiveAccountId(v)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue>
          {accounts?.find(a => a.id === activeAccountId)?.name || t('select_account')}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {accounts?.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
