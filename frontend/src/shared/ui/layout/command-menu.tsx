'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  GitBranch,
  Tags,
  Calendar,
  Plus,
  Search,
  User,
  Calculator,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useUiStore } from '@/shared/model/use-ui-store';
import { useTranslations } from 'next-intl';

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const tt = useTranslations('Transactions');
  
  const { setCreateTransactionDrawerOpen } = useUiStore();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Tapez une commande ou recherchez..." />
      <CommandList>
        <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push('/'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/transactions'))}>
            <Receipt className="mr-2 h-4 w-4" />
            <span>Transactions</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/budgets'))}>
            <Calculator className="mr-2 h-4 w-4" />
            <span>Budgets</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/evolution'))}>
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>Évolution</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/calendar'))}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Calendrier</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/categories'))}>
            <GitBranch className="mr-2 h-4 w-4" />
            <span>Catégories</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/tags'))}>
            <Tags className="mr-2 h-4 w-4" />
            <span>Tags</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => setCreateTransactionDrawerOpen(true))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>{tt('add_transaction')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/transactions/import'))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Importer CSV</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Paramètres">
          <CommandItem onSelect={() => runCommand(() => router.push('/accounts'))}>
            <User className="mr-2 h-4 w-4" />
            <span>Gérer les comptes</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
