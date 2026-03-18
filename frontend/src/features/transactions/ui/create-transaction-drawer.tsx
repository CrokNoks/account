'use client';

import { useState, useRef, SetStateAction } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useCreateTransaction } from '../api/use-create-transaction';
import { useCreateTransfer } from '../api/use-create-transfer';
import { useScanReceipt } from '@/features/reporting/api/use-scan-receipt';
import { useUiStore } from '@/shared/model/use-ui-store';
import { TransactionForm, TransactionFormValues } from './transaction-form';
import { Receipt, ArrowRightLeft, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { toCents, toAbsCents } from '@/shared/lib/format';

export function CreateTransactionDrawer() {
  const t = useTranslations('Transactions');
  const { activeAccountId } = useAccountStore();
  const { isCreateTransactionDrawerOpen, setCreateTransactionDrawerOpen } = useUiStore();
  const { data: periods } = usePeriods(activeAccountId);
  const { mutate: createTransaction, isPending: isCreatingTransaction } = useCreateTransaction();
  const { mutate: createTransfer, isPending: isCreatingTransfer } = useCreateTransfer();
  const { mutate: scanReceipt, isPending: isScanning } = useScanReceipt();

  const isPending = isCreatingTransaction || isCreatingTransfer || isScanning;
  const [mode, setMode] = useState<'standard' | 'transfer'>('standard');
  const [initialValues, setInitialValues] = useState<Partial<TransactionFormValues>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePeriod = periods?.find(p => p.isActive);

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAccountId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        
        scanReceipt({ 
          accountId: activeAccountId, 
          base64Image: compressedBase64, 
          mimeType: 'image/jpeg' 
        }, {
          onSuccess: (data) => {
            setInitialValues(prev => ({
              ...prev,
              date: data.date || prev.date,
              amount: data.amount?.toString() || prev.amount,
              description: data.description || prev.description,
            }));
            toast.success("Ticket analysé avec succès !");
          },
          onError: () => {
            toast.error("Erreur lors de l'analyse du ticket.");
          }
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenChange = (open: boolean) => {
    setCreateTransactionDrawerOpen(open);
    if (!open) {
      setInitialValues({});
      setMode('standard');
    }
  };

  const handleSubmit = (values: TransactionFormValues, addAnother = false) => {
    if (!activeAccountId) return;

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
          toast.success(`Transfer "${values.description}" created`);
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
          toast.success(`Transaction "${values.description}" added`);
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
            <SheetTitle>{mode === 'standard' ? t('new_transaction_title') : 'Nouveau transfert'}</SheetTitle>
            
            <div className="lg:hidden">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleScanReceipt}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-2 border-primary/30 text-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
              >
                {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                <span>Scanner</span>
              </Button>
            </div>

            <div className="hidden lg:flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded border">
              <span className="opacity-70 mr-0.5 text-[9px] uppercase tracking-wider">Mode:</span>
              <kbd className="font-mono">⇧</kbd>
              <span>+</span>
              <kbd className="font-mono">Tab</kbd>
            </div>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as SetStateAction<'standard' | 'transfer'>)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="standard" className="gap-2">
                <Receipt className="w-4 h-4" /> Standard
              </TabsTrigger>
              <TabsTrigger value="transfer" className="gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Transfert
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
            submitLabel={t('save')}
            mode={mode}
            key={`${mode}-${JSON.stringify(initialValues)}`}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
