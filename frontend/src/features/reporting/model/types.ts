export interface ReportingStats {
  startBalance: string;
  realIncome: string;
  plannedIncome: string;
  realExpenses: string;
  plannedExpenses: string;
  realBankBalance: string;
  upcomingBalance: string;
  forecastBalance: string;
}

export interface BudgetCategoryBreakdown {
  categoryId: string;
  name: string;
  real: string;
  budget: string;
  remaining: string;
  percentage: number;
  color?: string;
}

export interface BudgetBreakdownResponse {
  income: BudgetCategoryBreakdown[];
  expenses: BudgetCategoryBreakdown[];
  savings: BudgetCategoryBreakdown[];
  transfers: BudgetCategoryBreakdown[];
}

export interface EvolutionDataPoint {
  periodId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  realIncome: string;
  realExpenses: string;
  forecastBalance: string;
  realBankBalance: string;
  categories?: Record<string, string>;
}

export interface CashflowEvent {
  date: string;
  description: string;
  amount: string;
  projectedBalance: string;
  type: 'current_balance' | 'recurring';
}

export interface CashflowForecastResponse {
  currentBalance: string;
  events: CashflowEvent[];
}

export interface SankeyNode {
  id: string;
  name: string;
  color?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyDataResponse {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface CalendarEvent {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: 'actual' | 'recurring';
  categoryId: string | null;
}

export interface Anomaly {
  id: string;
  type: 'duplicate' | 'spike' | 'outlier' | 'unexpected_amount' | 'missing_recurring' | 'unusual_category';
  title?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  transactionIds: string[];
  metadata?: Record<string, any>;
}

export interface NetWorthDataPoint {
  date: string;
  amount: string;
}

export interface NetWorthResponse {
  currentTotal: string;
  history: NetWorthDataPoint[];
}

export interface ComparisonPoint {
  categoryId: string;
  name: string;
  period1Real: string;
  period2Real: string;
  diff: string;
  percentageDiff: number;
}

export interface PeriodComparisonResponse {
  income: ComparisonPoint[];
  expenses: ComparisonPoint[];
  savings: ComparisonPoint[];
  transfers: ComparisonPoint[];
}

export interface ScanReceiptResponse {
  date: string | null;
  amount: number | null;
  description: string | null;
}
