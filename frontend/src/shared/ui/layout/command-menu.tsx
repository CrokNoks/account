'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
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
import { NAV_ENTRIES, SETTINGS_PAGES } from './nav-config';

export function CommandMenu() {
  const router = useRouter();
  const tt = useTranslations('Transactions');
  const tn = useTranslations('Navigation');
  
  // L'état est dans le store : le raccourci ⌘/Ctrl + K et le champ « Rechercher » de l'en-tête ouvrent la même palette.
  const { setCreateTransactionDrawerOpen, isCommandMenuOpen: open, setCommandMenuOpen: setOpen } = useUiStore();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!useUiStore.getState().isCommandMenuOpen);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setOpen]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={tn('command.title')} description={tn('command.description')}>
      <CommandInput placeholder={tn('command.placeholder')} />
      <CommandList>
        <CommandEmpty>{tn('command.empty')}</CommandEmpty>
        <CommandGroup heading={tn('command.group_navigation')}>
          {NAV_ENTRIES.map((page) => {
            const Icon = page.icon;
            return (
              <CommandItem key={page.href} onSelect={() => runCommand(() => router.push(page.href))}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{tn(page.labelKey)}</span>
              </CommandItem>
            );
          })}
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
          {SETTINGS_PAGES.map(({ href, labelKey, icon: Icon }) => (
            <CommandItem key={href} onSelect={() => runCommand(() => router.push(href))}>
              <Icon className="mr-2 h-4 w-4" />
              <span>{tn(labelKey)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
