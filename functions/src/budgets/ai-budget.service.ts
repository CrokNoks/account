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
    // 1. Fetch Templates (The "Ideal")
    const { data: templates } = await this.supabase.getClientWithToken(token)
      .from('budget_templates')
      .select('category_id, amount_base, is_fixed')
      .eq('account_id', accountId);

    if (!templates) return [];

    // 2. Map templates to instances
    // For variable expenses, we could look at history (avg of last 3 months).
    // For now, simply use the 'amount_base' from the template.

    return templates.map(t => ({
      category_id: t.category_id,
      amount_allocated: t.amount_base
    }));
  }
}
