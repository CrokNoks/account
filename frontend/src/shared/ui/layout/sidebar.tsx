'use client';

import {Link} from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  TrendingUp,
  Calendar,
  CreditCard, 
  Receipt, 
  PieChart, 
  Settings,
  Repeat,
  LogOut
} from 'lucide-react';
import { createClient } from '@/shared/lib/supabase/supabase-browser';
import { useRouter } from '@/i18n/routing';
import {useTranslations} from 'next-intl';

const menuItems = [
  { icon: LayoutDashboard, labelKey: 'dashboard', href: '/' },
  { icon: TrendingUp, labelKey: 'evolution', href: '/evolution' },
  { icon: Calendar, labelKey: 'cashflow', href: '/cashflow' },
  { isSeparator: true },
  { icon: CreditCard, labelKey: 'accounts', href: '/accounts' },
  { icon: Settings, labelKey: 'categories', href: '/categories' },
  { icon: Repeat, labelKey: 'recurring', href: '/recurring' },
  { icon: PieChart, labelKey: 'budgets', href: '/budgets' },
  { icon: Receipt, labelKey: 'transactions', href: '/transactions' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations('Navigation');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex flex-col w-64 border-r bg-card min-h-screen">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">Account V2</h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item, index) => {
          if ('isSeparator' in item) {
            return <div key={`sep-${index}`} className="my-4 border-t border-muted" />;
          }

          const Icon = item.icon;
          // Note: with next-intl, pathname includes locale
          const isActive = pathname.endsWith(item.href === '/' ? '/fr' : item.href) || 
                           pathname.endsWith(item.href === '/' ? '/en' : item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent text-muted-foreground hover:text-accent-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">{t('logout')}</span>
        </button>
      </div>
    </div>
  );
}
