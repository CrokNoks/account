'use client';

import { formatShortRange } from '@/shared/lib/date-only';
import { useLocale, useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Period } from '../model/types';
import { periodEnd } from '../model/period-end';

export const ALL_PERIODS = 'all';

interface PeriodSelectProps {
  periods?: Period[];
  /** Identifiant de la période choisie, ou `ALL_PERIODS` (avec `allowAll`). */
  value: string | null;
  onChange: (value: string) => void;
  /** Ajoute l'option « toutes les périodes ». */
  allowAll?: boolean;
}

/** Sélecteur de période partagé par Aujourd'hui et Opérations. */
export function PeriodSelect({ periods, value, onChange, allowAll = false }: PeriodSelectProps) {
  const t = useTranslations('PeriodSelect');
  const locale = useLocale();
  const range = (p: Period) => formatShortRange(p.startDate, periodEnd(p), locale);
  const current = periods?.find((p) => p.id === value);
  const label = value === ALL_PERIODS && allowAll ? t('all') : current ? range(current) : t('select');

  return (
    <Select value={value || ''} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="h-8 rounded-full bg-primary/10 text-primary border-primary/20 px-4 hover:bg-primary/20 transition-colors">
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value={ALL_PERIODS}>{t('all')}</SelectItem>}
        {periods?.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {range(p)} {p.isActive && t('active_suffix')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
