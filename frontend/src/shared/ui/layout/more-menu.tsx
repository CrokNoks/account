'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import { LogOut, Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { MORE_ENTRY_HREFS, NAV_ENTRIES, activeEntryHref } from './nav-config';
import { useLogout } from './use-logout';

const ITEM = 'flex items-center gap-3 min-h-11 px-3 rounded-lg transition-colors';

/** « Plus » de la barre du bas : Budgets, Échéances, Réglages, puis Déconnexion. */
export function MoreMenu() {
  const pathname = usePathname();
  const t = useTranslations('Navigation');
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const entries = NAV_ENTRIES.filter((e) => MORE_ENTRY_HREFS.includes(e.href));
  const isActive = MORE_ENTRY_HREFS.includes(activeEntryHref(pathname) ?? '');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        data-tour="nav-more"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex flex-col items-center justify-center flex-1 min-w-11 min-h-11 gap-1 h-16 transition-colors',
          isActive || open ? 'text-primary font-semibold' : 'text-foreground/80 hover:text-foreground',
        )}
      >
        <Menu className={cn('w-6 h-6', isActive && 'stroke-[2.5px]')} />
        <span className="text-xs leading-tight text-center">{t('more')}</span>
      </button>

      {open && (
        <>
          <div data-testid="more-backdrop" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="fixed right-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 w-56 rounded-xl border bg-popover text-popover-foreground shadow-lg p-1"
          >
            {entries.map((item) => {
              const Icon = item.icon;
              const active = activeEntryHref(pathname) === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(ITEM, active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="font-medium">{t(item.labelKey)}</span>
                </Link>
              );
            })}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className={cn(ITEM, 'w-full border-t rounded-t-none mt-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10')}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="font-medium">{t('logout')}</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}
