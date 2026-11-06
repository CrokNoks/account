'use client';

import {Link} from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '@/shared/lib/supabase/supabase-browser';
import { useRouter } from '@/i18n/routing';
import {useTranslations} from 'next-intl';
import { NAV_ENTRIES, activeEntryHref } from './nav-config';

const TOUR_TARGETS: Record<string, string> = { budgets: 'nav-budgets', settings: 'nav-settings' };

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

      const match = e.key.match(/^F([2-6])$/);
      if (!match) return;

      e.preventDefault();
      
      const target = NAV_ENTRIES.find(item => 'shortcut' in item && item.shortcut === e.key);
      if (target) {
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
        {NAV_ENTRIES.map((item) => {
          const Icon = item.icon;
          const isActive = activeEntryHref(pathname) === item.href;

          return (
            <Link
              key={item.href}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={item.href as any}
              data-tour={TOUR_TARGETS[item.labelKey]}
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
                  "text-[10px] max-lg:text-xs font-mono px-1.5 py-0.5 rounded border transition-colors",
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
