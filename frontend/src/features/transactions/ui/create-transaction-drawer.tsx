'use client';

import { useState, SetStateAction } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useCreateTransaction } from '../api/use-create-transaction';
import { useCreateTransfer } from '../api/use-create-transfer';
import { useUiStore } from '@/shared/model/use-ui-store';
import { TransactionForm, TransactionFormValues } from './transaction-form';
import { Receipt, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { toCents, toAbsCents, isUnreadableAmount } from '@/shared/lib/format';

export function CreateTransactionDrawer() {
  const t = useTranslations('Transactions');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { isCreateTransactionDrawerOpen, setCreateTransactionDrawerOpen } = useUiStore();
  const { data: periods } = usePeriods(activeAccountId);
  const { mutate: createTransaction, isPending: isCreatingTransaction } = useCreateTransaction();
  const { mutate: createTransfer, isPending: isCreatingTransfer } = useCreateTransfer();

  const isPending = isCreatingTransaction || isCreatingTransfer;
  const [mode, setMode] = useState<'standard' | 'transfer'>('standard');
  const [initialValues, setInitialValues] = useState<Partial<TransactionFormValues>>({});

  const activePeriod = periods?.find(p => p.isActive);

  const handleOpenChange = (open: boolean) => {
    setCreateTransactionDrawerOpen(open);
    if (!open) {
      setInitialValues({});
      setMode('standard');
    }
  };

  const handleSubmit = (values: TransactionFormValues, addAnother = false) => {
    if (!activeAccountId) return;
    if (isUnreadableAmount(values.amount)) {
      toast.error(tc('invalid_amount'));
      return;
    }

    if (mode === 'transfer') {
      if (!values.destinationAccountId) return;
      createTransfer({
        sourceAccountId: activeAccountId,
        destinationAccountId: values.destinationAccountId,
        amount: toAbsCents(values.amount),
        date: values.date,
        description: values.description,
      }, {
        onSuccess: () => {
          toast.success(t('transfer_created', { description: values.description }));
          setInitialValues({});
          if (!addAnother) setCreateTransactionDrawerOpen(false);
        }
      });
    } else {
      createTransaction({
        accountId: activeAccountId,
        date: values.date,
        description: values.description,
        categoryId: values.categoryId || null,
        amount: toCents(values.amount),
        periodId: activePeriod?.id,
        pending: values.pending,
        tagIds: values.tagIds,
      }, {
        onSuccess: () => {
          toast.success(t('transaction_added', { description: values.description }));
          setInitialValues({});
          if (!addAnother) setCreateTransactionDrawerOpen(false);
        }
      });
    }
  };

  return (
    <Sheet open={isCreateTransactionDrawerOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b space-y-4">
          <div className="flex items-center justify-between">
            <SheetTitle>{mode === 'standard' ? t('new_transaction_title') : t('new_transfer_title')}</SheetTitle>
            
            <div className="hidden lg:flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded border">
              <span className="opacity-70 mr-0.5 text-[9px] uppercase tracking-wider">{t('mode_shortcut')}</span>
              <kbd className="font-mono">⇧</kbd>
              <span>+</span>
              <kbd className="font-mono">Tab</kbd>
            </div>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as SetStateAction<'standard' | 'transfer'>)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="standard" className="gap-2">
                <Receipt className="w-4 h-4" /> {t('mode_standard')}
              </TabsTrigger>
              <TabsTrigger value="transfer" className="gap-2">
                <ArrowRightLeft className="w-4 h-4" /> {t('mode_transfer')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          <TransactionForm 
            accountId={activeAccountId}
            initialValues={initialValues}
            onSubmit={(v) => handleSubmit(v, false)}
            onAddAnother={(v) => handleSubmit(v, true)}
            isPending={isPending}
            submitLabel={tc('save')}
            mode={mode}
            key={`${mode}-${JSON.stringify(initialValues)}`}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
