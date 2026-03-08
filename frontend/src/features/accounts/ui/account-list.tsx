'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAccounts, Account } from '../api/use-accounts';
import { useUpdateAccount } from '../api/use-update-account';
import { formatCurrency } from '@/shared/lib/format';
import { CreditCard, Landmark, Wallet, Pencil } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';

const typeIcons: Record<string, any> = {
  checking: CreditCard,
  savings: Landmark,
  cash: Wallet,
};

export function AccountList() {
  const { data: accounts, isLoading } = useAccounts();
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

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
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    onClick={() => setEditingAccount(account)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(account.initialBalance)}
                </div>
                <p className="text-xs text-muted-foreground capitalize mt-1">
                  {account.type} • {account.currency}
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
    </>
  );
}

function EditAccountDialog({ account, open, onOpenChange }: { account: Account, open: boolean, onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState(account.name);
  const [balance, setBalance] = useState((parseInt(account.initialBalance, 10) / 100).toString());
  const { mutate: updateAccount, isPending } = useUpdateAccount();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAccount({
      id: account.id,
      data: {
        name,
        initialBalance: (parseFloat(balance) * 100).toString(),
      } as any
    }, {
      onSuccess: () => {
        toast.success(`Account "${name}" updated`);
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Initial Balance</label>
            <Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Updating...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
