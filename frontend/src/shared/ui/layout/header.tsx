'use client';

import { usePathname } from 'next/navigation';
import { AccountSelector } from '@/features/accounts/ui/account-selector';
import { useTranslations, useLocale } from 'next-intl';
import { Link, routing } from '@/i18n/routing';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useRouter } from '@/i18n/routing';

const routeKeys: Record<string, string> = {
  '/': 'dashboard',
  '/accounts': 'accounts',
  '/transactions': 'transactions',
  '/budgets': 'budgets',
  '/categories': 'categories'
};

export function Header() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('Navigation');

  // Find the key by checking if pathname ends with the route
  const currentKey = Object.keys(routeKeys).find(route => 
    pathname.endsWith(route === '/' ? `/${locale}` : route)
  ) || '/';
  
  const label = t(routeKeys[currentKey] || 'dashboard');

  const handleLocaleChange = (newLocale: string | null) => {
    if (!newLocale) return;
    // router.replace keeps the same pathname but changes the locale
    router.replace(pathname as any, { locale: newLocale as any });
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6 lg:h-[60px] mb-8 -mt-8 -mx-8">
      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-xl">{label}</h1>
      </div>
      <div className="flex items-center gap-4">
        <Select value={locale} onValueChange={handleLocaleChange}>
          <SelectTrigger className="w-[70px] border-none bg-transparent hover:bg-accent transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {routing.locales.map((l) => (
              <SelectItem key={l} value={l}>
                {l.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="h-6 w-px bg-border" />
        <AccountSelector />
      </div>
    </header>
  );
}
