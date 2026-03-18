'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useTranslations } from 'next-intl';

export interface AccountFormValues {
  name: string;
  type: string;
  description: string;
  currency: string;
  balance: string;
}

interface AccountFormProps {
  initialValues?: Partial<AccountFormValues>;
  onSubmit: (values: AccountFormValues) => void;
  isPending: boolean;
  submitLabel: string;
  showTypeAndCurrency?: boolean;
}

export function AccountForm({
  initialValues,
  onSubmit,
  isPending,
  submitLabel,
  showTypeAndCurrency = true,
}: AccountFormProps) {
  const t = useTranslations('Accounts');
  const tc = useTranslations('Common');

  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [type, setType] = useState(initialValues?.type || 'checking');
  const [currency, setCurrency] = useState(initialValues?.currency || 'EUR');
  const [balance, setBalance] = useState(initialValues?.balance || '0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      type,
      currency,
      balance,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('fields.name')}</label>
        <Input 
          placeholder="Checking Account, Savings..." 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {showTypeAndCurrency && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.type')}</label>
            <Select value={type} onValueChange={(v) => setType(v || 'checking')}>
              <SelectTrigger>
                <SelectValue>
                  {t(`types.${type as 'checking' | 'savings' | 'cash'}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">{t('types.checking')}</SelectItem>
                <SelectItem value="savings">{t('types.savings')}</SelectItem>
                <SelectItem value="cash">{t('types.cash')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.currency')}</label>
            <Select value={currency} onValueChange={(v) => setCurrency(v || 'EUR')}>
              <SelectTrigger>
                <SelectValue>
                  {currency === 'EUR' ? 'EUR (€)' : 'USD ($)'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

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

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('fields.description')}</label>
        <Textarea 
          placeholder="Ex: Compte pour les dépenses du quotidien, loyer et abonnements..." 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="resize-none h-20"
        />
        <p className="text-[10px] text-muted-foreground italic">
          {t('fields.description_hint')}
        </p>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? tc('loading') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
