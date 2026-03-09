'use client';

import { SankeyChart } from "@/features/reporting/ui/sankey-chart";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useTranslations } from 'next-intl';

export default function FluxPage() {
  const t = useTranslations('Reporting');
  const { activeAccountId, activePeriodId } = useAccountStore();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Flux de trésorerie</h2>
        <p className="text-muted-foreground">
          Visualisation des entrées et sorties d'argent pour la période sélectionnée.
        </p>
      </div>

      <SankeyChart accountId={activeAccountId} periodId={activePeriodId} />
    </div>
  );
}
