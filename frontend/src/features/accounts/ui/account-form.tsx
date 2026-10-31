'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from 'next-intl';

export interface AccountFormValues {
  name: string;
  balance: string;
}

interface AccountFormProps {
  initialValues?: Partial<AccountFormValues>;
  onSubmit: (values: AccountFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}

export function AccountForm({
  initialValues,
  onSubmit,
  isPending,
  submitLabel,
}: AccountFormProps) {
  const t = useTranslations('Accounts');
  const tc = useTranslations('Common');

  const [name, setName] = useState(initialValues?.name || '');
  const [balance, setBalance] = useState(initialValues?.balance || '0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      balance,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('fields.name')}</label>
        <Input 
          placeholder={t('fields.name_placeholder')} 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('fields.balance')}</label>
        <Input 
          type="number" 
          step="0.01"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          required
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? tc('loading') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
