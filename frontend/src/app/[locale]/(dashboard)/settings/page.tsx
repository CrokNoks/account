'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { SETTINGS_PAGES } from '@/shared/ui/layout/nav-config';

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const tn = useTranslations('Navigation');

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-3xl font-bold tracking-tight max-lg:hidden">{t('title')}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_PAGES.map(({ href, labelKey, descriptionKey, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="flex flex-col gap-1">
                <span className="font-medium">{tn(labelKey)}</span>
                <span className="text-sm text-muted-foreground">{t(descriptionKey)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
