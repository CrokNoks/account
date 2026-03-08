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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useCreateAccount } from '../api/use-create-account';
import { Plus } from 'lucide-react';

export function CreateAccountDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('checking');
  const [currency, setCurrency] = useState('EUR');
  const [balance, setBalance] = useState('0');
  
  const { mutate: createAccount, isPending } = useCreateAccount();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccount({
      name,
      type,
      currency,
      initialBalance: (parseFloat(balance) * 100).toString(),
    }, {
      onSuccess: () => {
        setOpen(false);
        setName('');
        setBalance('0');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add Account
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Bank Account</DialogTitle>
          <DialogDescription>
            Enter the details of your new bank account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input 
              placeholder="Checking Account, Savings..." 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={(v) => setType(v || 'checking')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Currency</label>
              <Select value={currency} onValueChange={(v) => setCurrency(v || 'EUR')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Initial Balance</label>
            <Input 
              type="number" 
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
