'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
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
import { useCreateAccount } from '../api/use-create-account';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUiStore } from '@/shared/model/use-ui-store';
import { toCents } from '@/shared/lib/format';

export function CreateAccountDialog() {
  const t = useTranslations('Accounts');
  const tc = useTranslations('Common');
  
  const { isCreateAccountDialogOpen, setCreateAccountDialogOpen } = useUiStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('checking');
  const [currency, setCurrency] = useState('EUR');
  const [balance, setBalance] = useState('0');
  
  const { mutate: createAccount, isPending } = useCreateAccount();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccount({
      name,
      type,
      description,
      currency,
      initialBalance: toCents(balance),
    }, {
      onSuccess: () => {
        setCreateAccountDialogOpen(false);
        setName('');
        setDescription('');
        setBalance('0');
      }
    });
  };

  return (
    <Dialog open={isCreateAccountDialogOpen} onOpenChange={setCreateAccountDialogOpen}>
      <DialogTrigger 
        render={
          <Button className="gap-2" onClick={() => setCreateAccountDialogOpen(true)} data-tour="add-account-btn">
            <Plus className="w-4 h-4" />
            {t('add_account')}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('new_account_title')}</DialogTitle>
          <DialogDescription>
            {t('new_account_desc')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2" data-tour="account-name">
            <label className="text-sm font-medium">{t('fields.name')}</label>
            <Input 
              placeholder="Checking Account, Savings..." 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2" data-tour="account-type">
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
          <div className="space-y-2" data-tour="account-balance">
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
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? tc('loading') : tc('add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
