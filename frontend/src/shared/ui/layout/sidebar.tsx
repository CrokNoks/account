'use client';

import {Link} from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp,
  GitBranch,
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
  { icon: LayoutDashboard, labelKey: 'dashboard', href: '/', shortcut: 'F2' },
  { icon: TrendingUp, labelKey: 'evolution', href: '/evolution', shortcut: 'F3' },
  { icon: GitBranch, labelKey: 'flux', href: '/flux', shortcut: 'F4' },
  { icon: Calendar, labelKey: 'prevision', href: '/cashflow', shortcut: 'F5' },
  { isSeparator: true },
  { icon: CreditCard, labelKey: 'accounts', href: '/accounts', shortcut: 'F6' },
  { icon: Settings, labelKey: 'categories', href: '/categories', shortcut: 'F7' },
  { icon: Repeat, labelKey: 'recurring', href: '/recurring', shortcut: 'F8' },
  { icon: PieChart, labelKey: 'budgets', href: '/budgets', shortcut: 'F9' },
  { icon: Receipt, labelKey: 'transactions', href: '/transactions', shortcut: 'F10' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations('Navigation');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only listen if not in an input/textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.hasAttribute('contenteditable')
      ) {
        return;
      }

      const match = e.key.match(/^F([2-9]|10)$/);
      if (!match) return;

      e.preventDefault();
      
      const target = menuItems.find(item => !('isSeparator' in item) && item.shortcut === e.key);
      if (target && 'href' in target) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(target.href as any);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex flex-col w-64 border-r bg-card h-full">
      <div className="p-6 shrink-0">
        <h1 className="text-2xl font-bold text-primary">Account V2</h1>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-2 flex flex-col overflow-y-auto custom-scrollbar">
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={item.href as any}
              data-tour={item.labelKey === 'categories' ? 'nav-categories' : item.labelKey === 'recurring' ? 'nav-recurring' : item.labelKey === 'budgets' ? 'nav-budgets' : undefined}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent text-muted-foreground hover:text-accent-foreground"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="font-medium flex-1">{t(item.labelKey)}</span>
              {'shortcut' in item && (
                <span className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors",
                  isActive
                    ? "border-primary-foreground/30 text-primary-foreground/70"
                    : "border-muted text-muted-foreground/50 group-hover:text-muted-foreground group-hover:border-muted-foreground/30"
                )}>
                  {item.shortcut}
                </span>
              )}
            </Link>
          );
        })}

        {/* Spacer to push logout to bottom */}
        <div className="flex-1" />
        
        <div className="border-t border-muted pt-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{t('logout')}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
