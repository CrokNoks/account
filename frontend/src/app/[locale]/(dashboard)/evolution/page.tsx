import { EvolutionChart } from "@/features/reporting/ui/evolution-chart";
import { useTranslations } from 'next-intl';

export default function EvolutionPage() {
  const t = useTranslations('Reporting');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">{t('evolution_title')}</h2>
        <p className="text-muted-foreground">
          {t('evolution_desc')}
        </p>
      </div>

      <EvolutionChart />
    </div>
  );
}
