import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AiBudgetService {
  constructor(private readonly supabase: SupabaseService) { }

  /**
   * Predicts the end date and budget instances for the next period.
   */
  async predictPeriodParams(accountId: string, startDate: string, token: string) {
    const endDate = await this.predictEndDate(accountId, startDate, token);
    const budgets = await this.predictBudgets(accountId, token);

    return {
      startDate,
      endDate,
      budgets,
    };
  }

  private async predictEndDate(accountId: string, startDate: string, token: string): Promise<string> {
    // 1. Fetch previous periods to find patterns
    const { data: periods } = await this.supabase.getClientWithToken(token)
      .from('periods')
      .select('start_date, end_date')
      .eq('account_id', accountId)
      .order('start_date', { ascending: false })
      .limit(5);

    // Default: 30 days ahead if no history
    const start = new Date(startDate);

    if (!periods || periods.length === 0) {
      const end = new Date(start);
      end.setDate(end.getDate() + 30);
      return end.toISOString().split('T')[0];
    }

    // Heuristic: Check if there's a preferred "Day of Month" for ending
    // For now, let's keep it simple: Average duration of last 3 periods, or stick to 30 days.
    // TODO: Implement smarter logic or use LLM.

    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    return end.toISOString().split('T')[0];
  }

  private async predictBudgets(accountId: string, token: string) {
    const supabase = this.supabase.getClientWithToken(token);

    // 1. Fetch Templates (The "Base")
    const { data: templates } = await supabase
      .from('budget_templates')
      .select('category_id, amount_base, is_fixed')
      .eq('account_id', accountId);

    const templateMap = new Map((templates || []).map(t => [t.category_id, t]));

    // 2. Fetch History for Prediction (Last 6 closed periods)
    const { data: periods, error } = await supabase
      .from('periods')
      .select('id, start_date, end_date')
      .eq('account_id', accountId)
      .eq('is_active', false) // Changed from status='closed' to is_active=false to match schema
      .order('start_date', { ascending: false })
      .limit(6);

    // 2. Fetch History for Prediction (Last 6 closed periods)
    if (error) {
      console.error("AiBudgetService: Error fetching periods", error);
    }

    const predictions = new Map<string, number>();

    if (periods && periods.length >= 2) {
      // Sort oldest first
      periods.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

      // Fetch expenses for these periods
      // Optimized: Single query instead of N+1 queries
      const periodIds = periods.map(p => p.id);
      const { data: allExpenses } = await supabase
        .from('expenses')
        .select('category_id, amount, date, period_id')
        .in('period_id', periodIds)
        .eq('account_id', accountId)
        .not('category_id', 'is', null);

      // Map expenses to period index for processing
      const flatExpenses = (allExpenses || []).map(expense => {
        const periodIndex = periods.findIndex(p => p.id === expense.period_id);
        return { ...expense, pIndex: periodIndex >= 0 ? periodIndex : 0 };
      });

      // Aggregate by Category & Period Index
      const history = new Map<string, Map<number, number>>();
      flatExpenses.forEach(e => {
        if (!e.category_id) return;
        if (!history.has(e.category_id)) history.set(e.category_id, new Map());
        const catMap = history.get(e.category_id)!;
        catMap.set(e.pIndex, (catMap.get(e.pIndex) || 0) + Math.abs(e.amount));
      });

      // Predict for each category
      for (const [catId, periodMap] of history.entries()) {
        const x: number[] = [];
        const y: number[] = [];

        periods.forEach((_, i) => {
          // Treat missing as 0 for budgeting purposes
          x.push(i);
          y.push(periodMap.get(i) || 0);
        });

        // Simple Linear Regression (Least Squares)
        // y = mx + c
        // m = (N * Σ(xy) - Σx * Σy) / (N * Σ(x^2) - (Σx)^2)
        // c = (Σy - m * Σx) / N

        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, i) => a + x[i] * y[i], 0);
        const sumXX = x.reduce((a, b) => a + b * b, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Predict next period (index = n)
        let prediction = slope * n + intercept;

        // Constraint: No negative budgets
        if (prediction < 0) prediction = 0;

        // If average is non-zero but prediction is 0 due to slope, maybe safeguard? 
        // Let's stick to pure regression for now.

        if (prediction > 0) {
          predictions.set(catId, prediction);
        }
      }
    }

    // 3. Merge Strategies
    // Union of Template Categories and Predicted Categories
    const allCategoryIds = new Set([...templateMap.keys(), ...predictions.keys()]);

    const budgets = Array.from(allCategoryIds).map(catId => {
      const template = templateMap.get(catId);
      const predictedAmount = predictions.get(catId);
      const baseAmount = template?.amount_base || 0;

      let finalAmount = baseAmount;

      if (predictedAmount !== undefined && predictedAmount > 0) {
        // trust AI if available (even for fixed, as they may vary)
        finalAmount = predictedAmount;
      } else if (template) {
        // Fallback to template base
        finalAmount = baseAmount;
      } else {
        // AI suggests 0 or undefined, and no template? Should be 0.
        finalAmount = 0;
      }

      if (template?.is_fixed) {
        finalAmount = template.amount_base;
      }

      return {
        category_id: catId,
        amount_allocated: finalAmount,
        base_amount: baseAmount,
        ai_suggestion: predictedAmount || 0,
        is_fixed: template?.is_fixed || false
      };
    });

    return budgets.filter(b => b.amount_allocated > 0 || b.ai_suggestion > 0);
  }
}
