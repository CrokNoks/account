'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { analysisSpan } from '../model/analysis-periods';
import { monthName } from './analyses/period-label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BreakdownTab } from './analyses/breakdown-tab';
import { EvolutionTab } from './analyses/evolution-tab';
import { OverrunsTab } from './analyses/overruns-tab';

export type AnalysesTab = 'breakdown' | 'evolution' | 'overruns';

const TABS: readonly AnalysesTab[] = ['breakdown', 'evolution', 'overruns'];

/**
 * Écran Analyses : trois onglets dans un même écran. L'onglet est un état local
 * (aucune navigation, aucune adresse) ; `initialTab` fixe l'onglet de départ.
 */
export function AnalysesScreen({ initialTab = 'breakdown' }: { initialTab?: AnalysesTab }) {
  const t = useTranslations('Reporting.analyses');
  const locale = useLocale();
  const { activeAccountId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  const span = analysisSpan(periods);
  const from = span && monthName(span.from, locale);
  const to = span && monthName(span.to, locale);
  const subtitle = !span
    ? null
    : span.count === 1
      ? t('subtitle_one', { month: from! })
      : from === to
        ? t('subtitle_same_month', { count: String(span.count), month: from! })
        : t('subtitle_many', { count: String(span.count), from: from!, to: to! });
  const [tab, setTab] = useState<AnalysesTab>(initialTab);

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      {subtitle && (
        <p data-testid="analyses-subtitle" className="text-sm text-muted-foreground">
          {subtitle}
        </p>
      )}
      <Tabs value={tab} onValueChange={(v) => setTab(v as AnalysesTab)}>
        <TabsList variant="line" aria-label={t('tabs_label')} className="max-lg:w-full max-lg:!h-11 lg:!h-auto">
          {TABS.map((name) => (
            <TabsTrigger key={name} value={name} className="min-h-11 px-4 text-sm">
              {t(`tab_${name}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="breakdown" className="pt-4"><BreakdownTab /></TabsContent>
        <TabsContent value="evolution" className="pt-4"><EvolutionTab /></TabsContent>
        <TabsContent value="overruns" className="pt-4"><OverrunsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
