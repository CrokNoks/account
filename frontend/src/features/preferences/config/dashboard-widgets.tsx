'use client';

import React from 'react';
import { 
  StatStartBalance,
  StatRealIncome,
  StatRealExpenses,
  StatBankBalance,
  StatUpcomingBalance,
  StatForecastBalance
} from "@/features/reporting/ui/dashboard-stats";
import { AnomaliesWidget } from "@/features/reporting/ui/anomalies-widget";
import { BudgetBreakdown } from "@/features/reporting/ui/budget-breakdown";
import { TagStatsSummary } from "@/features/tags/ui/tag-stats-summary";
import { NetWorthWidget } from "@/features/reporting/ui/net-worth-widget";
import { UpcomingDeadlinesWidget } from "@/features/reporting/ui/upcoming-deadlines-widget";
import { MonthlyPulseWidget } from "@/features/reporting/ui/monthly-pulse-widget";
import { TopExpensesWidget } from "@/features/reporting/ui/top-expenses-widget";
import { TransactionList } from "@/features/transactions/ui/transaction-list";
import { Card } from "@/components/ui/card";

export const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  'stat-start': StatStartBalance,
  'stat-income': StatRealIncome,
  'stat-expenses': StatRealExpenses,
  'stat-bank': StatBankBalance,
  'stat-upcoming': StatUpcomingBalance,
  'stat-forecast': StatForecastBalance,
  'anomalies': AnomaliesWidget,
  'net-worth': NetWorthWidget,
  'pulse': MonthlyPulseWidget,
  'top-expenses': TopExpensesWidget,
  'upcoming': UpcomingDeadlinesWidget,
  'breakdown': () => (
    <div data-tour="budget-breakdown" className="h-full">
      <BudgetBreakdown />
    </div>
  ),
  'tags': TagStatsSummary,
  'transactions': () => (
    <div data-tour="transaction-list" className="h-full min-h-0">
      <Card className="border-2 shadow-sm h-full overflow-hidden flex flex-col pt-0">
        <TransactionList compact />
      </Card>
    </div>
  ),
};

export const ALL_AVAILABLE_WIDGETS = [
  { id: 'stat-start' },
  { id: 'stat-income' },
  { id: 'stat-expenses' },
  { id: 'stat-bank' },
  { id: 'stat-upcoming' },
  { id: 'stat-forecast' },
  { id: 'net-worth' },
  { id: 'pulse' },
  { id: 'anomalies' },
  { id: 'breakdown' },
  { id: 'top-expenses' },
  { id: 'tags' },
  { id: 'upcoming' },
  { id: 'transactions' },
];

export const DEFAULT_WIDGETS = [
  { id: 'stat-start', width: 2, desktopVisible: true, mobileVisible: true },
  { id: 'stat-income', width: 2, desktopVisible: true, mobileVisible: true },
  { id: 'stat-expenses', width: 2, desktopVisible: true, mobileVisible: true },
  { id: 'stat-bank', width: 2, desktopVisible: true, mobileVisible: true },
  { id: 'stat-upcoming', width: 2, desktopVisible: true, mobileVisible: true },
  { id: 'stat-forecast', width: 2, desktopVisible: true, mobileVisible: true },
  { id: 'net-worth', width: 6, desktopVisible: true, mobileVisible: true },
  { id: 'pulse', width: 6, desktopVisible: true, mobileVisible: true },
  { id: 'anomalies', width: 12, desktopVisible: true, mobileVisible: true },
  { id: 'breakdown', width: 6, desktopVisible: true, mobileVisible: true },
  { id: 'top-expenses', width: 6, desktopVisible: true, mobileVisible: true },
  { id: 'transactions', width: 12, desktopVisible: true, mobileVisible: true },
];
