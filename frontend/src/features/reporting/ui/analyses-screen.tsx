'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BreakdownTab } from './analyses/breakdown-tab';
import { EvolutionTab } from './analyses/evolution-tab';
import { OverrunsTab } from './analyses/overruns-tab';

export type AnalysesTab = 'breakdown' | 'evolution' | 'overruns';

const TABS: readonly AnalysesTab[] = ['breakdown', 'evolution', 'overruns'];

/**
 * Écran Analyses : trois onglets dans un même écran. L'onglet est un état local
 * (aucune navigation, aucune adresse) ; `initialTab` vient de l'adresse ouverte.
 */
export function AnalysesScreen({ initialTab = 'breakdown' }: { initialTab?: AnalysesTab }) {
  const t = useTranslations('Reporting.analyses');
  const [tab, setTab] = useState<AnalysesTab>(initialTab);

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex flex-col gap-2 max-lg:hidden">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">{t('desc')}</p>
      </div>

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
