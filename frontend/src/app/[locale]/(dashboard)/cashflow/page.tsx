'use client';

import { CashflowForecast } from "@/features/reporting/ui/cashflow-forecast";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useTranslations } from 'next-intl';

export default function CashflowPage() {
  const t = useTranslations('Reporting');
  const { activeAccountId } = useAccountStore();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Prévisions de trésorerie</h2>
        <p className="text-muted-foreground">
          Projection de votre solde sur les 90 prochains jours basée sur vos opérations récurrentes.
        </p>
      </div>

      <CashflowForecast accountId={activeAccountId} />
    </div>
  );
}
