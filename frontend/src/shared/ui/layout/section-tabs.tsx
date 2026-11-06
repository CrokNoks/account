'use client';

import { Link } from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { tabsFor } from './nav-config';

/** Barre d'onglets reliant les pages d'un même groupe (Échéances). */
export function SectionTabs({ entry }: { entry: '/calendar' }) {
  const pathname = usePathname();
  const t = useTranslations('Navigation');
  const path = pathname.replace(/^\/(fr|en)(?=\/|$)/, '').replace(/\/+$/, '') || '/';

  return (
    <nav aria-label={t('due_dates')} className="flex gap-1 border-b">
      {tabsFor(entry).map(({ href, labelKey }) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? 'page' : undefined}
          className={cn(
            '-mb-px px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            path === href
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t(labelKey)}
        </Link>
      ))}
    </nav>
  );
}
