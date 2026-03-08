'use client';

import { usePathname } from 'next/navigation';
import { AccountSelector } from '@/features/accounts/ui/account-selector';

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/accounts': 'Accounts',
  '/transactions': 'Transactions',
  '/budgets': 'Budgets',
};

export function Header() {
  const pathname = usePathname();
  const label = routeLabels[pathname] || 'Dashboard';

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6 lg:h-[60px] mb-8 -mt-8 -mx-8">
      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-xl">{label}</h1>
      </div>
      <div className="flex items-center gap-4">
        <AccountSelector />
      </div>
    </header>
  );
}

