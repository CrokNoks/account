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
  const tn = useTranslations('Navigation');
  
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
      <CommandInput placeholder={tn('command.placeholder')} />
      <CommandList>
        <CommandEmpty>{tn('command.empty')}</CommandEmpty>
        <CommandGroup heading={tn('command.group_navigation')}>
          <CommandItem onSelect={() => runCommand(() => router.push('/'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>{tn('dashboard')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/transactions'))}>
            <Receipt className="mr-2 h-4 w-4" />
            <span>{tn('transactions')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/budgets'))}>
            <Calculator className="mr-2 h-4 w-4" />
            <span>{tn('budgets')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/evolution'))}>
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>{tn('evolution')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/calendar'))}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>{tn('calendar')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/categories'))}>
            <GitBranch className="mr-2 h-4 w-4" />
            <span>{tn('categories')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/tags'))}>
            <Tags className="mr-2 h-4 w-4" />
            <span>{tn('tags')}</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={tn('command.group_actions')}>
          <CommandItem onSelect={() => runCommand(() => setCreateTransactionDrawerOpen(true))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>{tt('add_transaction')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/transactions/import'))}>
            <Search className="mr-2 h-4 w-4" />
            <span>{tn('command.import_csv')}</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={tn('command.group_settings')}>
          <CommandItem onSelect={() => runCommand(() => router.push('/accounts'))}>
            <User className="mr-2 h-4 w-4" />
            <span>{tn('command.manage_accounts')}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
