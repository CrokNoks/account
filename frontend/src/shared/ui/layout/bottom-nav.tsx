'use client';

import { Link } from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  TrendingUp,
  Receipt
} from 'lucide-react';
import { useTranslations } from 'next-intl';

const navItems = [
  { icon: LayoutDashboard, labelKey: 'dashboard', href: '/' },
  { icon: Receipt, labelKey: 'transactions', href: '/transactions' },
  { icon: TrendingUp, labelKey: 'evolution', href: '/evolution' },
];

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('Navigation');

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border px-2 pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.endsWith(item.href === '/' ? '/fr' : item.href) || 
                         pathname.endsWith(item.href === '/' ? '/en' : item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 gap-1 h-full transition-colors",
              isActive 
                ? "text-primary font-semibold" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
            <span className="text-[10px] truncate max-w-[64px]">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
