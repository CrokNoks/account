'use client';

import { usePathname } from 'next/navigation';
import { AccountSelector } from '@/features/accounts/ui/account-selector';
import { useTranslations, useLocale, Locale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { ThemeToggle } from './theme-toggle';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useRouter } from '@/i18n/routing';
import { headerTitleKey } from './header-title';

export function Header() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('Navigation');

  const label = t(headerTitleKey(pathname));

  const handleLocaleChange = (newLocale: string | null) => {
    if (!newLocale) return;
    // router.replace will change the locale via cookie when prefix is 'never'
    router.replace(pathname as string, { locale: newLocale as Locale });
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 lg:gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6 lg:h-[60px] mb-4 lg:mb-8 -mx-4 lg:-mx-8">
      <div className="flex-1 min-w-0">
        <h1 className="text-base lg:text-xl font-semibold truncate">{label}</h1>
      </div>
      <div className="flex items-center gap-1 lg:gap-4">
        <ThemeToggle />
        <Select value={locale} onValueChange={handleLocaleChange}>
          <SelectTrigger className="w-[44px] lg:w-[70px] max-lg:px-1.5 max-lg:justify-center max-lg:[&>svg]:hidden border-none bg-transparent hover:bg-accent transition-colors">
            <SelectValue className="max-lg:flex-none" />
          </SelectTrigger>
          <SelectContent>
            {routing.locales.map((l) => (
              <SelectItem key={l} value={l}>
                {l.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="hidden lg:block h-6 w-px bg-border" />
        <AccountSelector />
      </div>
    </header>
  );
}
