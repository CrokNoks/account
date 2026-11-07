'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** Bloc « Plus d'options » (mobile) : replié par défaut, il n'ajoute aucun champ tant qu'il est replié. */
export function MoreOptions({ defaultOpen = false, children }: { defaultOpen?: boolean; children: ReactNode }) {
  const t = useTranslations('Transactions');
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div data-testid="more-options" className="rounded-lg border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between min-h-11 px-3 text-sm font-medium"
      >
        <span>{t('more_options')}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-4 border-t p-3">{children}</div>}
    </div>
  );
}
