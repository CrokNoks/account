import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiBudgetService } from '../budgets/ai-budget.service';

export interface CreatePeriodDto {
  account_id: string;
  start_date: string;
  end_date: string;
  estimated_end_date?: string;
  budgets: {
    category_id: string;
    amount_allocated: number;
  }[];
}

@Injectable()
export class PeriodsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly aiBudgetService: AiBudgetService,
  ) { }

  async findAll(accountId: string, isActive: string | undefined, token: string) {
    let query = this.supabase.getClientWithToken(token)
      .from('periods')
      .select('*')
      .eq('account_id', accountId)
      .order('start_date', { ascending: false });

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data;
  }

  async findOne(id: string, token: string) {
    const { data, error } = await this.supabase.getClientWithToken(token)
      .from('periods')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Period not found');
    return data;
  }

  async findActive(accountId: string, token: string) {
    const { data, error } = await this.supabase.getClientWithToken(token)
      .from('periods')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message); // PGRST116 is 'not found'
    return data;
  }

  async previewNextPeriod(accountId: string, token: string) {
    // 1. Determine Start Date
    const { data: lastPeriod } = await this.supabase.getClientWithToken(token)
      .from('periods')
      .select('end_date')
      .eq('account_id', accountId)
      .order('end_date', { ascending: false })
      .limit(1)
      .single();

    let startDate: string;
    if (lastPeriod && lastPeriod.end_date) {
      const lastEnd = new Date(lastPeriod.end_date);
      lastEnd.setDate(lastEnd.getDate() + 1); // Start next day
      startDate = lastEnd.toISOString().split('T')[0];
    } else {
      startDate = new Date().toISOString().split('T')[0]; // Default to today if no previous period
    }

    // 2. Call AI service for End Date and Budgets
    return this.aiBudgetService.predictPeriodParams(accountId, startDate, token);
  }

  async createPeriodWithBudgets(dto: CreatePeriodDto, token: string) {
    const supabase = this.supabase.getClientWithToken(token);

    console.log(dto)

    // 1. Create Period
    const { data: period, error: periodError } = await supabase
      .from('periods')
      .insert({
        account_id: dto.account_id,
        start_date: dto.start_date,
        end_date: dto.end_date,
        estimated_end_date: dto.estimated_end_date || dto.end_date,
        is_active: true,
      })
      .select()
      .single();

    if (periodError) throw new Error(periodError.message);

    // 2. Create Budget Instances
    if (dto.budgets && dto.budgets.length > 0) {
      const instances = dto.budgets.map(b => ({
        period_id: period.id,
        category_id: b.category_id,
        amount_allocated: b.amount_allocated,
      }));

      const { error: budgetsError } = await supabase
        .from('budget_instances')
        .insert(instances);

      if (budgetsError) {
        // Rollback? Supabase REST doesn't support transactions easily without RPC.
        console.error("Failed to create budgets", budgetsError);
        // Clean up period?
        await supabase.from('periods').delete().eq('id', period.id);
        throw new Error(budgetsError.message);
      }
    }

    return period;
  }

  async closePeriod(id: string, token: string) {
    const { data, error } = await this.supabase.getClientWithToken(token)
      .from('periods')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
  async getReport(periodId: string, token: string) {
    const supabase = this.supabase.getClientWithToken(token);

    // 1. Fetch Period
    const period = await this.findOne(periodId, token);

    // 2. Fetch Expenses in Period
    let expenseQuery = supabase
      .from('expenses')
      .select('amount, category_id, date, description, reconciled')
      .eq('account_id', period.account_id)
      .gte('date', period.start_date);

    if (period.end_date) {
      expenseQuery = expenseQuery.lte('date', period.end_date);
    }

    const { data: expenses, error: expenseError } = await expenseQuery;
    if (expenseError) throw new Error(expenseError.message);

    // 3. Fetch Budgets
    const { data: budgets, error: budgetError } = await supabase
      .from('budget_instances')
      .select('category_id, amount_allocated')
      .eq('period_id', periodId);

    if (budgetError) throw new Error(budgetError.message);

    // 4. Fetch Categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, color, type')
      .eq('account_id', period.account_id);

    if (catError) throw new Error(catError.message);

    // 5. Calculate Initial Balance
    // 5a. Fetch Account Initial Balance
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('initial_balance')
      .eq('id', period.account_id)
      .single();

    if (accountError) throw new Error(accountError.message);

    // 5b. Sum Previous Operations
    // Note: We should ideally respect 'reconciled' for Bank Balance history, but simplified here as single stream.
    // For specific Bank Balance, we might need checking reconciled status of ALL previous ops.
    // Assuming 'initial_balance' is clean bank balance start.
    const { data: previousOps, error: prevError } = await supabase
      .from('expenses')
      .select('amount')
      .eq('account_id', period.account_id)
      .lt('date', period.start_date); // Strictly before start date

    if (prevError) throw new Error(prevError.message);

    const previousOpsSum = previousOps?.reduce((sum, op) => sum + Number(op.amount), 0) || 0;
    const initialBalance = (account?.initial_balance || 0) + previousOpsSum;

    // 6. Aggregate Data
    let totalIncome = 0;
    let totalExpense = 0;
    let reconciledSum = 0; // For Bank Balance (relative to period start)

    const categoryStats = new Map<string, {
      category: any;
      budgeted: number;
      spent: number;
      remaining: number;
      type: string;
    }>();

    // Initialize stats with budgets
    budgets?.forEach(b => {
      const cat = categories?.find(c => c.id === b.category_id);
      categoryStats.set(b.category_id, {
        category: cat || { id: b.category_id, name: 'Unknown', color: '#ccc' },
        budgeted: b.amount_allocated,
        spent: 0,
        remaining: b.amount_allocated,
        type: cat?.type || 'expense',
      });
    });

    // Process expenses
    expenses?.forEach(e => {
      const amount = Number(e.amount);

      if (e.reconciled) {
        reconciledSum += amount;
      }

      if (amount > 0) {
        totalIncome += amount;

      } else {
        totalExpense += Math.abs(amount);
      }

      // Add to category stats
      const catId = e.category_id || 'uncategorized';
      if (!categoryStats.has(catId)) {
        const cat = categories?.find(c => c.id === catId);
        categoryStats.set(catId, {
          category: cat || { id: catId, name: 'Sans catégorie', color: '#999' },
          budgeted: 0,
          spent: 0,
          remaining: 0,
          type: cat?.type || 'expense',
        });
      }

      const stat = categoryStats.get(catId)!;
      stat.spent += amount;

      stat.type = stat.spent < 0 ? 'expense' : 'income';


      stat.remaining = stat.budgeted - Math.abs(stat.spent);
    });

    // --- Calculate Balances ---

    // 1. Bank Balance (Solde Bancaire)
    // = Initial Balance + Sum of Reconciled Operations in this period
    const bankBalance = initialBalance + reconciledSum;

    // 2. Future Balance (Solde à venir)
    // = Initial Balance + Total Income - Total Expense (All operations)
    const futureBalance = initialBalance + totalIncome - totalExpense;

    // 3. Projected Balance (Solde Théorique)
    // = Initial Balance + Projected Income - Projected Expenses
    // Projected for Category = Max(Budget, Actual)
    let projectedIncome = 0;
    let projectedExpense = 0;

    for (const stat of categoryStats.values()) {
      const projectedAmt = Math.max(stat.budgeted, Math.abs(stat.spent));
      if (stat.type === 'income') {
        projectedIncome += projectedAmt;
      } else {
        projectedExpense += projectedAmt;
      }
    }

    const projectedBalance = initialBalance + projectedIncome - projectedExpense;

    return {
      period,
      initialBalance,
      bankBalance,
      futureBalance,
      projectedBalance,
      totalIncome,
      totalExpense,
      netResult: totalIncome - totalExpense,
      categoryBreakdown: Array.from(categoryStats.values()),
    };
  }


  async remove(id: string, token: string) {
    const { error } = await this.supabase.getClientWithToken(token)
      .from('periods')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
  }
}
