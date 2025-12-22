export interface Category {
  id: string;
  name: string;
  color: string;
  budget?: number | null;
  type?: 'income' | 'expense' | null;
}

export interface Expense {
  id: string;
  amount: number;
  category_id: string | null;
  reconciled: boolean;
  date?: string; // Optional depending on usage
}

export interface ReportCategoryData {
  id: string;
  name: string;
  value: number;
  color: string;
  budget?: number; // Removed | null to match global types
}

export interface ReportTotals {
  totalIncome: number;
  totalExpense: number;
  reconciledBalance: number;
  unreconciledBalance: number;
  unreconciledCount: number;
  netResult: number;
  expensePieData: ReportCategoryData[];
  incomePieData: ReportCategoryData[];
  expenseCount: number;
}

/**
 * Calculates totals and category distributions from a list of expenses.
 */
export const calculateReportTotals = (
  expenses: Expense[],
  allCategories: Category[],
  initialBalance: number
): ReportTotals => {
  let totalIncome = 0;
  let totalExpense = 0;
  let reconciledBalance = 0;
  let unreconciledBalance = 0;
  let unreconciledCount = 0;

  const expenseCategoryMap = new Map<string, ReportCategoryData>();
  const incomeCategoryMap = new Map<string, ReportCategoryData>();

  // Initialize maps with typed categories
  allCategories.forEach(cat => {
    const catData: ReportCategoryData = {
      id: cat.id,
      name: cat.name,
      value: 0,
      color: cat.color,
      budget: cat.budget || undefined
    };

    if (cat.type === 'income') {
      incomeCategoryMap.set(cat.id, catData);
    } else if (cat.type === 'expense') {
      expenseCategoryMap.set(cat.id, catData);
    }
  });

  expenses.forEach((exp) => {
    const amount = Number(exp.amount);
    const catId = exp.category_id;
    const category = allCategories.find(c => c.id === catId);

    // Update global totals (based on raw amount sign)
    if (amount > 0) {
      totalIncome += amount;
    } else {
      totalExpense += Math.abs(amount);
    }

    // Update Category Maps
    if (category && category.type === 'income') {
      if (incomeCategoryMap.has(catId!)) {
        incomeCategoryMap.get(catId!)!.value += amount;
      }
    } else if (category && category.type === 'expense') {
      if (expenseCategoryMap.has(catId!)) {
        // Invert sign for expense view (positive value = cost)
        expenseCategoryMap.get(catId!)!.value += -amount;
      }
    } else {
      // No type or unknown category: fallback to amount sign
      // Note: Ideally all categories should have a type, but handling legacy/uncategorized here.
      const catName = category?.name || 'Sans catégorie';
      const catColor = category?.color || '#ccc';
      const catBudget = category?.budget || undefined;

      // Use a safe ID for map keys if catId is null
      const safeKey = catId || 'uncategorized';

      if (amount > 0) {
        if (!incomeCategoryMap.has(safeKey)) {
          incomeCategoryMap.set(safeKey, { id: safeKey, name: catName, value: 0, color: catColor, budget: catBudget });
        }
        incomeCategoryMap.get(safeKey)!.value += amount;
      } else {
        if (!expenseCategoryMap.has(safeKey)) {
          expenseCategoryMap.set(safeKey, { id: safeKey, name: catName, value: 0, color: catColor, budget: catBudget });
        }
        expenseCategoryMap.get(safeKey)!.value += Math.abs(amount);
      }
    }

    if (exp.reconciled) {
      reconciledBalance += amount;
    } else {
      unreconciledBalance += amount;
      unreconciledCount++;
    }
  });

  return {
    totalIncome,
    totalExpense,
    reconciledBalance,
    unreconciledBalance,
    unreconciledCount,
    netResult: initialBalance + totalIncome - totalExpense,
    expensePieData: Array.from(expenseCategoryMap.values()).filter(c => c.value > 0 || (c.budget && c.budget! > 0)),
    incomePieData: Array.from(incomeCategoryMap.values()).filter(c => c.value > 0 || (c.budget && c.budget! > 0)),
    expenseCount: expenses.length
  };
};

export interface ChartPoint {
  reportId: string;
  reportLabel: string;
  [key: string]: any;
}

export interface CategoryStat {
  categoryId: string;
  name: string;
  color: string;
  totalExpense: number;
  totalRevenue: number;
  reportCount: number;
  min: number;
  max: number;
}

/**
 * Aggregates data from multiple reports for the Evolution Chart.
 */
export const aggregateEvolutionData = (reports: any[], locale: string = 'fr-FR', translate: (key: string) => string): { chartPoints: ChartPoint[], categoryStats: CategoryStat[] } => {
  const categoryMap = new Map<string, CategoryStat>();
  const chartPoints: ChartPoint[] = [];

  reports.forEach((report: any) => {
    const startDate = new Date(report.start_date);
    const endDate = new Date(report.end_date);
    // Using provided locale instead of hook
    const reportLabel = `${startDate.toLocaleDateString(locale, { month: 'short', year: '2-digit' })} - ${endDate.toLocaleDateString(locale, { month: 'short', year: '2-digit' })}`;

    const point: ChartPoint = {
      reportId: report.id,
      reportLabel
    };

    // Process pie data from report
    if (report.data?.expensePieData && Array.isArray(report.data.expensePieData)) {
      report.data.expensePieData.forEach((cat: any) => {
        const catKey = cat.name || translate('resources.categories.uncategorized');
        const catColor = cat.color || '#ccc';
        const catValue = cat.value || 0;

        // Update category summary
        if (!categoryMap.has(catKey)) {
          categoryMap.set(catKey, {
            categoryId: catKey,
            name: catKey,
            color: catColor,
            totalExpense: 0,
            totalRevenue: 0,
            reportCount: 0,
            min: Infinity,
            max: -Infinity
          });
        }

        const catData = categoryMap.get(catKey)!;
        catData.totalExpense += catValue;
        catData.reportCount++;
        catData.min = Math.min(catData.min, catValue);
        catData.max = Math.max(catData.max, catValue);

        // Add to chart point
        point[`expense_${catKey}`] = catValue;
      });
    }

    // Process revenues
    const totalRevenue = report.data?.totalIncome || 0;
    point['revenue_Total'] = totalRevenue;

    chartPoints.push(point);
  });

  const categoryStats = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  return { chartPoints, categoryStats };
}
