
interface CategoryData {
  id: string;
  name: string;
  value: number;
  color: string;
  budget?: number;
}


interface CategorySummaryTableProps {
  data: CategoryData[];
  title: string;
  type?: 'expense' | 'income';
  sx?: any;
}

interface ReportData {
  startDate: string;
  endDate: string | null;
  initialBalance: number;
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  reconciledBalance: number;
  unreconciledBalance: number;
  unreconciledCount: number;
  expensePieData: CategoryData[];
  incomePieData: CategoryData[];
  expenseCount: number;
  rawExpenses?: { amount: number; date: string }[];
}