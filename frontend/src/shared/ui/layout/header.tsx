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
import { Search } from 'lucide-react';
import { useUiStore } from '@/shared/model/use-ui-store';

export function Header() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('Navigation');
  const setCommandMenuOpen = useUiStore((state) => state.setCommandMenuOpen);

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
        {/* Point d'entrée visible de la palette (le raccourci ⌘/Ctrl + K reste). Pas de champ sur mobile. */}
        <button
          type="button"
          data-testid="search-field"
          onClick={() => setCommandMenuOpen(true)}
          className="hidden lg:flex h-9 w-64 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">{t('search')}</span>
          <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">⌘K</kbd>
        </button>
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
        {/* Grand écran : le compte est en haut du menu latéral ; mobile (pas de menu) : il reste ici. */}
        <div className="lg:hidden">
          <AccountSelector />
        </div>
      </div>
    </header>
  );
}
