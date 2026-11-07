export interface ReportingStats {
  startBalance: string;
  realIncome: string;
  plannedIncome: string;
  realExpenses: string;
  plannedExpenses: string;
  realBankBalance: string;
  upcomingBalance: string;
  forecastBalance: string;
  /** Composition du prévu : lignes signées en centimes (voir docs/reporting.md). */
  cardTotal: string;
  cardCount: number;
  billsTotal: string;
  budgetRemaining: string;
  expectedIncome: string;
}

export interface SpendingPacePoint {
  day: number;
  date: string;
  cumulative: string;
  previousCumulative: string | null;
}

export interface SpendingPace {
  points: SpendingPacePoint[];
  previousPeriodId: string | null;
  gap: string | null;
}

/** Prévu que donneraient les stats si les budgets saisis étaient enregistrés (centimes, texte). */
export interface ForecastSimulation {
  forecastBalance: string;
  savedForecastBalance: string;
  delta: string;
  incomeEffect: string;
  expensesEffect: string;
  plannedIncome: string;
  plannedExpenses: string;
  realIncome: string;
  realExpenses: string;
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
  /** Plus bas solde de fin de journée de l'horizon, calculé par le back (le front ne le recalcule pas). */
  lowPoint: { date: string; balance: string };
}

export interface CalendarEvent {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: 'actual' | 'recurring';
  categoryId: string | null;
  /** Facture en attente (transaction `pending`) ; toujours fourni par le back (faux pour une récurrence projetée). */
  pending: boolean;
}

export interface Anomaly {
  id: string;
  type: 'duplicate' | 'outlier';
  title?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  transactionIds: string[];
  metadata?: Record<string, unknown>;
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

export interface CategoryOverrunItem {
  categoryId: string;
  name: string;
  budget: string;
  real: string;
  overrun: string;
}

export interface PeriodOverruns {
  periodId: string;
  startDate: string;
  endDate: string;
  overruns: CategoryOverrunItem[];
}

export interface OverrunsByPeriodResponse {
  periods: PeriodOverruns[];
}

export interface CategoryOverrunChartPoint {
  periodId: string;
  startDate: string;
  endDate: string;
  budget: string;
  /** Réel signé en centimes (dépense négative), `pending` exclues. */
  real: string;
  overrun: string;
}

export interface CategoryOverrunsChartResponse {
  categoryId: string;
  points: CategoryOverrunChartPoint[];
}
