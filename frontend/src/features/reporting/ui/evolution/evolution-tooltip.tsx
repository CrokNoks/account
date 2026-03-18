'use client';

import { formatCurrency } from "@/shared/lib/format";

export type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color?: string;
    fill?: string;
  }>;
  label?: string;
};

export function EvolutionTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border p-3 rounded-lg shadow-md min-w-[150px]">
        <p className="text-xs font-bold mb-2 border-b pb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-[11px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-muted-foreground">{entry.name}:</span>
              </div>
              <span className="font-bold">{formatCurrency((Math.round(entry.value * 100)).toString())}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
