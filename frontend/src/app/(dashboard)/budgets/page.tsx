import { CreatePeriodDialog } from "@/features/periods/ui/create-period-dialog";
import { PeriodList } from "@/features/periods/ui/period-list";

export default function PeriodsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">Financial Periods</h2>
          <p className="text-muted-foreground">
            Define your budget cycles and analyze your performance.
          </p>
        </div>
        <CreatePeriodDialog />
      </div>

      <PeriodList />
    </div>
  );
}
