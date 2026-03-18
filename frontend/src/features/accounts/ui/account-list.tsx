'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAccounts, Account } from '../api/use-accounts';
import { useUpdateAccount } from '../api/use-update-account';
import { formatCurrency, toCents, fromCents } from '@/shared/lib/format';
import { LucideIcon, CreditCard, Landmark, Wallet, Pencil, Share2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter 
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ShareAccountDialog } from './share-account-dialog';
import { AccountForm, AccountFormValues } from './account-form';

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
  const { mutate: updateAccount, isPending } = useUpdateAccount();

  const handleSubmit = (values: AccountFormValues) => {
    updateAccount({
      id: account.id,
      data: {
        name: values.name,
        description: values.description,
        initialBalance: toCents(values.balance),
      }
    }, {
      onSuccess: () => {
        toast.success(tc('success'));
        onOpenChange(false);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>{tc('edit')} {t('title').toLowerCase()}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          <AccountForm 
            initialValues={{
              name: account.name,
              description: account.description || '',
              balance: fromCents(account.initialBalance),
              type: account.type,
              currency: account.currency
            }}
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel={tc('save')}
            showTypeAndCurrency={false}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
