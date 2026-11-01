'use client';

import React from 'react';
import {
  StatBankBalance,
  StatUpcomingBalance,
  StatIncomeExpenses,
} from "@/features/reporting/ui/dashboard-stats";
import { AnomaliesWidget } from "@/features/reporting/ui/anomalies-widget";
import { BudgetBreakdown } from "@/features/reporting/ui/budget-breakdown";
import { TagStatsSummary } from "@/features/tags/ui/tag-stats-summary";
import { NetWorthWidget } from "@/features/reporting/ui/net-worth-widget";
import { UpcomingDeadlinesWidget } from "@/features/reporting/ui/upcoming-deadlines-widget";
import { TransactionList } from "@/features/transactions/ui/transaction-list";
import { Card } from "@/components/ui/card";

export const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  'stat-bank': () => (
    <div data-tour="stats" className="h-full">
      <StatBankBalance />
    </div>
  ),
  'stat-upcoming': StatUpcomingBalance,
  // Identifiant historique gardé : les dispositions enregistrées le référencent déjà.
  'stat-income': StatIncomeExpenses,
  'anomalies': AnomaliesWidget,
  'net-worth': NetWorthWidget,
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
  { id: 'stat-bank' },
  { id: 'stat-upcoming' },
  { id: 'stat-income' },
  { id: 'net-worth' },
  { id: 'upcoming' },
  { id: 'anomalies' },
  { id: 'breakdown' },
  { id: 'tags' },
  { id: 'transactions' },
];

// Même disposition que UserPreferences.create (back).
export const DEFAULT_WIDGETS = [
  { id: 'stat-bank', width: 4, desktopVisible: true, mobileVisible: true },
  { id: 'stat-upcoming', width: 4, desktopVisible: true, mobileVisible: true },
  { id: 'stat-income', width: 4, desktopVisible: true, mobileVisible: true },
  { id: 'net-worth', width: 6, desktopVisible: true, mobileVisible: true },
  { id: 'upcoming', width: 6, desktopVisible: true, mobileVisible: true },
  { id: 'anomalies', width: 12, desktopVisible: true, mobileVisible: true },
  { id: 'breakdown', width: 6, desktopVisible: true, mobileVisible: true },
  { id: 'tags', width: 6, desktopVisible: true, mobileVisible: true },
  { id: 'transactions', width: 12, desktopVisible: true, mobileVisible: true },
];
