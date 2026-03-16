'use client';

import { FinancialCalendar } from "@/features/reporting/ui/financial-calendar";

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Calendrier Financier</h2>
        <p className="text-muted-foreground">
          Visualisez vos flux de trésorerie passés et prévus.
        </p>
      </div>

      <FinancialCalendar />
    </div>
  );
}
