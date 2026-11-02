'use client';

import { useTranslations } from 'next-intl';
import { FinancialCalendar } from "@/features/reporting/ui/financial-calendar";

export default function CalendarPage() {
  const t = useTranslations('Reporting.calendar');

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex flex-col gap-2 max-lg:hidden">
        <h2 className="text-3xl font-bold tracking-tight">{t('page_title')}</h2>
        <p className="text-muted-foreground">
          {t('page_desc')}
        </p>
      </div>

      <FinancialCalendar />
    </div>
  );
}
