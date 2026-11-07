'use client';

import { useRef, useState, SetStateAction } from 'react';
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
import { useIsDesktop } from '@/shared/lib/use-is-desktop';
import { toEntryCents } from '../model/entry-amount';

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
  const [formKey, setFormKey] = useState(0);

  const desktop = useIsDesktop();
  // Verrou synchrone : isPending n'est vrai qu'au rendu suivant, deux appuis rapprochés passeraient.
  const submitLock = useRef(false);

  const activePeriod = periods?.find(p => p.isActive);

  const handleOpenChange = (open: boolean) => {
    setCreateTransactionDrawerOpen(open);
    if (!open) {
      setInitialValues({});
      setFormKey(k => k + 1);
      setMode('standard');
    }
  };

  const handleSubmit = (values: TransactionFormValues, addAnother = false) => {
    if (!activeAccountId || submitLock.current) return;

    // Mobile : le sens fixe le signe, plus de 2 décimales refusé. Bureau : signe tapé, inchangé.
    let amount: string;
    if (desktop) {
      if (isUnreadableAmount(values.amount)) {
        toast.error(tc('invalid_amount'));
        return;
      }
      amount = mode === 'transfer' ? toAbsCents(values.amount) : toCents(values.amount);
    } else {
      const entry = toEntryCents(values.amount, mode === 'transfer' ? 'transfer' : values.direction ?? 'expense');
      if (entry.status === 'empty') return;
      if (entry.status !== 'ok') {
        toast.error(entry.status === 'unreadable' ? tc('invalid_amount') : t(`amount_${entry.status}`));
        return;
      }
      amount = entry.cents;
    }
    const release = { onSettled: () => { submitLock.current = false; } };

    if (mode === 'transfer') {
      if (!values.destinationAccountId) return;
      submitLock.current = true;
      createTransfer({
        sourceAccountId: activeAccountId,
        destinationAccountId: values.destinationAccountId,
        amount,
        date: values.date,
        description: values.description,
      }, {
        ...release,
        onSuccess: () => {
          toast.success(t('transfer_created', { description: values.description }));
          setInitialValues({});
          setFormKey(k => k + 1);
          if (!addAnother) setCreateTransactionDrawerOpen(false);
        }
      });
    } else {
      submitLock.current = true;
      createTransaction({
        accountId: activeAccountId,
        date: values.date,
        description: values.description,
        categoryId: values.categoryId || null,
        amount,
        periodId: activePeriod?.id,
        pending: values.pending,
        tagIds: values.tagIds,
      }, {
        ...release,
        onSuccess: () => {
          toast.success(t('transaction_added', { description: values.description }));
          setInitialValues({});
          setFormKey(k => k + 1);
          if (!addAnother) setCreateTransactionDrawerOpen(false);
        }
      });
    }
  };

  return (
    <Sheet open={isCreateTransactionDrawerOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0" closeClassName="max-lg:size-11 max-lg:top-2 max-lg:right-2">
        <SheetHeader className="p-6 border-b space-y-4">
          <div className="flex items-center justify-between">
            <SheetTitle>{mode === 'standard' ? t('new_transaction_title') : t('new_transfer_title')}</SheetTitle>
            
            <div data-tour="tx-shortcuts" className="hidden lg:flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded border">
              <span className="opacity-70 mr-0.5 text-[9px] max-lg:text-xs uppercase tracking-wider">{t('mode_shortcut')}</span>
              <kbd className="font-mono">⇧</kbd>
              <span>+</span>
              <kbd className="font-mono">Tab</kbd>
            </div>
          </div>
          {/* Mobile : le virement se choisit dans « Plus d'options » du formulaire. */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as SetStateAction<'standard' | 'transfer'>)} className="w-full max-lg:hidden">
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
            submitLabel={desktop ? tc('save') : tc('add')}
            mode={mode}
            onModeChange={setMode}
            // Bureau : l'onglet repart d'un formulaire neuf. Mobile : la case Virement garde la saisie.
            key={desktop ? `${mode}-${formKey}` : formKey}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
