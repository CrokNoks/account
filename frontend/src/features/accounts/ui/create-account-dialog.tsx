'use client';

import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateAccount } from '../api/use-create-account';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUiStore } from '@/shared/model/use-ui-store';
import { toCents } from '@/shared/lib/format';
import { AccountForm, AccountFormValues } from './account-form';

export function CreateAccountDialog() {
  const t = useTranslations('Accounts');
  const tc = useTranslations('Common');
  
  const { isCreateAccountDialogOpen, setCreateAccountDialogOpen } = useUiStore();
  const { mutate: createAccount, isPending } = useCreateAccount();

  const handleSubmit = (values: AccountFormValues) => {
    createAccount({
      name: values.name,
      type: values.type,
      description: values.description,
      currency: values.currency,
      initialBalance: toCents(values.balance),
    }, {
      onSuccess: () => {
        setCreateAccountDialogOpen(false);
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
        <AccountForm 
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel={tc('add')}
        />
      </DialogContent>
    </Dialog>
  );
}
