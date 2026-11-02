'use client';

import { Fragment } from 'react';
import { Link } from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  TrendingUp,
  Receipt,
  Plus
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUiStore } from '@/shared/model/use-ui-store';

const navItems = [
  { icon: LayoutDashboard, labelKey: 'dashboard', href: '/' },
  { icon: Receipt, labelKey: 'transactions', href: '/transactions' },
  { icon: TrendingUp, labelKey: 'evolution', href: '/evolution' },
];

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('Navigation');
  const tt = useTranslations('Transactions');
  const setCreateTransactionDrawerOpen = useUiStore((state) => state.setCreateTransactionDrawerOpen);

  // « + » in the middle of the bar (replaces the floating button on mobile)
  const plusButton = (
    <button
      type="button"
      aria-label={tt('add_transaction')}
      onClick={() => setCreateTransactionDrawerOpen(true)}
      className="flex items-center justify-center shrink-0 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-md active:scale-95 transition-transform"
    >
      <Plus className="w-6 h-6" />
    </button>
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around min-h-16 bg-background border-t border-border px-2 pb-[env(safe-area-inset-bottom)]">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = pathname.endsWith(item.href === '/' ? '/fr' : item.href) || 
                         pathname.endsWith(item.href === '/' ? '/en' : item.href);

        return (
          <Fragment key={item.href}>
            {index === 2 && plusButton}
          <Link
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 min-w-0 gap-1 h-16 transition-colors",
              isActive 
                ? "text-primary font-semibold" 
                : "text-foreground/80 hover:text-foreground"
            )}
          >
            <Icon className={cn("w-6 h-6", isActive && "stroke-[2.5px]")} />
            <span className="text-xs leading-tight text-center">{t(item.labelKey)}</span>
          </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
