'use client';

import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger
} from "@/components/ui/sheet";
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
    <Sheet open={isCreateAccountDialogOpen} onOpenChange={setCreateAccountDialogOpen}>
      <SheetTrigger 
        render={
          <Button className="gap-2" onClick={() => setCreateAccountDialogOpen(true)} data-tour="add-account-btn">
            <Plus className="w-4 h-4" />
            {t('add_account')}
          </Button>
        }
      />
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>{t('new_account_title')}</SheetTitle>
          <SheetDescription>
            {t('new_account_desc')}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          <AccountForm 
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel={tc('add')}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
