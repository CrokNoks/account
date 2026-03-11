'use client';

import { EvolutionChart } from "@/features/reporting/ui/evolution-chart";
import { EvolutionAIInsightsCard } from "@/features/reporting/ui/evolution-ai-insights-card";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useTranslations } from 'next-intl';

export default function EvolutionPage() {
  const t = useTranslations('Reporting');
  const { activeAccountId } = useAccountStore();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">{t('evolution_title')}</h2>
        <p className="text-muted-foreground">
          {t('evolution_desc')}
        </p>
      </div>

      <EvolutionAIInsightsCard accountId={activeAccountId} />

      <div className="space-y-12">
        <EvolutionChart />
      </div>
    </div>
  );
}
