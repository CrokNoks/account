'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAccounts, Account } from '../api/use-accounts';
import { useUpdateAccount } from '../api/use-update-account';
import { formatCurrency } from '@/shared/lib/format';
import { LucideIcon, CreditCard, Landmark, Wallet, Pencil, Share2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ShareAccountDialog } from './share-account-dialog';

const typeIcons: Record<string, LucideIcon> = {
  checking: CreditCard,
  savings: Landmark,
  cash: Wallet,
};

export function AccountList() {
  const t = useTranslations('Accounts');
  const { data: accounts, isLoading } = useAccounts();
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [sharingAccount, setSharingAccount] = useState<Account | null>(null);

  if (isLoading) return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
      ))}
    </div>
  );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts?.map((account) => {
          const Icon = typeIcons[account.type] || Landmark;
          
          return (
            <Card key={account.id} className="group hover:border-primary/50 transition-colors relative">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    onClick={() => setSharingAccount(account)}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    onClick={() => setEditingAccount(account)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Icon className="w-4 h-4 text-muted-foreground ml-1" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(account.initialBalance)}
                </div>
                <p className="text-xs text-muted-foreground capitalize mt-1">
                  {t(`types.${account.type || 'checking'}`)} • {account.currency}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editingAccount && (
        <EditAccountDialog 
          account={editingAccount} 
          open={!!editingAccount} 
          onOpenChange={(open) => !open && setEditingAccount(null)} 
        />
      )}

      {sharingAccount && (
        <ShareAccountDialog
          accountId={sharingAccount.id}
          accountName={sharingAccount.name}
          open={!!sharingAccount}
          onOpenChange={(open) => !open && setSharingAccount(null)}
        />
      )}
    </>
  );
}

function EditAccountDialog({ account, open, onOpenChange }: { account: Account, open: boolean, onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('Accounts');
  const tc = useTranslations('Common');
  const [name, setName] = useState(account.name);
  const [description, setDescription] = useState(account.description || '');
  const [balance, setBalance] = useState((parseInt(account.initialBalance, 10) / 100).toString());
  const { mutate: updateAccount, isPending } = useUpdateAccount();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAccount({
      id: account.id,
      data: {
        name,
        description,
        initialBalance: Math.round(parseFloat(balance) * 100).toString(),
      }
    }, {
      onSuccess: () => {
        toast.success(tc('success'));
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tc('edit')} {t('title').toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.name')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.balance')}</label>
            <Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} required />
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
              {isPending ? tc('loading') : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
