import { Injectable, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiBudgetService } from '../budgets/ai-budget.service';

/**
 * DTO for creating a new period with budgets
 */
export interface CreatePeriodDto {
  account_id: string;
  start_date: string;
  end_date?: string;
  estimated_end_date?: string;
  budgets: {
    category_id: string;
    amount_allocated: number;
  }[];
}

/**
 * Service for managing period operations
 * Handles period CRUD, budget generation, and financial reporting
 */
@Injectable()
export class PeriodsService {
  private readonly logger = new Logger(PeriodsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly aiBudgetService: AiBudgetService,
  ) {}

  /**
   * Retrieve all periods for an account
   * Optionally filter by active status
   * @param accountId - The account ID
   * @param isActive - Filter by active status (optional)
   * @param token - Authorization token
   * @returns Array of periods
   * @throws InternalServerErrorException if query fails
   */
  async findAll(
    accountId: string,
    isActive: string | undefined,
    token: string,
  ): Promise<any[]> {
    let query = this.supabase
      .getClientWithToken(token)
      .from('periods')
      .select('*')
      .eq('account_id', accountId)
      .order('start_date', { ascending: false });

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to fetch periods for account ${accountId}:`, error);
      throw new InternalServerErrorException('Failed to fetch periods');
    }

    return data || [];
  }

  /**
   * Retrieve a single period by ID
   * @param id - Period ID
   * @param token - Authorization token
   * @returns Period data
   * @throws NotFoundException if period not found
   * @throws InternalServerErrorException if query fails
   */
  async findOne(id: string, token: string): Promise<any> {
    const { data, error } = await this.supabase
      .getClientWithToken(token)
      .from('periods')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch period ${id}:`, error);
      throw new InternalServerErrorException('Failed to fetch period');
    }

    if (!data) {
      throw new NotFoundException('Period not found');
    }

    return data;
  }

  /**
   * Retrieve the currently active period for an account
   * @param accountId - The account ID
   * @param token - Authorization token
   * @returns Active period data or null if no active period
   * @throws InternalServerErrorException if query fails
   */
  async findActive(accountId: string, token: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .getClientWithToken(token)
      .from('periods')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch active period for account ${accountId}:`, error);
      throw new InternalServerErrorException('Failed to fetch active period');
    }

    return data || null;
  }

  /**
   * Preview the next period with AI-generated suggestions
   * Determines start date from last period and calls AI service for budget predictions
   * @param accountId - The account ID
   * @param token - Authorization token
   * @returns Next period preview with AI-generated budgets and end date
   * @throws InternalServerErrorException if query or AI service fails
   */
  async previewNextPeriod(accountId: string, token: string): Promise<any> {
    // Determine Start Date
    const { data: lastPeriod, error: periodError } = await this.supabase
      .getClientWithToken(token)
      .from('periods')
      .select('end_date')
      .eq('account_id', accountId)
      .order('end_date', { ascending: false })
      .limit(1)
      .single();

    if (periodError && periodError.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch last period for account ${accountId}:`, periodError);
      throw new InternalServerErrorException('Failed to preview next period');
    }

    let startDate: string;

    if (lastPeriod && lastPeriod.end_date) {
      const lastEnd = new Date(lastPeriod.end_date);
      lastEnd.setDate(lastEnd.getDate() + 1);
      startDate = lastEnd.toISOString().split('T')[0];
    } else {
      startDate = new Date().toISOString().split('T')[0];
    }

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
        end_date: dto.end_date || null,
        estimated_end_date: dto.estimated_end_date || dto.end_date || null,
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

    // 5b. Sum Previous Operations using RPC for performance and correctness
    const { data: balanceHistory, error: historyError } = await supabase
      .rpc('get_balance_history', {
        p_account_id: period.account_id,
        p_date: period.start_date,
      })
      .single();

    if (historyError) throw new Error(historyError.message);

    const previousReconciledSum = Number((balanceHistory as any)?.reconciled_sum || 0);
    const previousUnreconciledSum = Number((balanceHistory as any)?.unreconciled_sum || 0);

    console.log(`[DEBUG] Period ${period.id} start: ${period.start_date}`);
    console.log(`[DEBUG] Account Initial Balance: ${account?.initial_balance}`);
    console.log(`[DEBUG] Previous Reconciled Sum: ${previousReconciledSum}`);
    console.log(`[DEBUG] Previous Unreconciled Sum: ${previousUnreconciledSum}`);

    // Initial Balance = Account Initial + Reconciled History
    // This matches the "Bank Balance" of the previous day
    const initialBalance = (account?.initial_balance || 0) + previousReconciledSum;

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

      // REMOVED: type inference based on transaction direction. We trust the category type.
      // (stat.type was initialized from category.type)

      stat.remaining = stat.budgeted - Math.abs(stat.spent);
    });

    // --- Calculate Balances ---

    // 1. Bank Balance (Solde Bancaire)
    // = Initial Balance + Sum of Reconciled Operations in this period
    const bankBalance = initialBalance + reconciledSum;

    // 2. Future Balance (Solde à venir)
    // = Initial Balance (Bank) + Previous Unreconciled + Current Income - Current Expense
    const futureBalance = initialBalance + previousUnreconciledSum + totalIncome - totalExpense;

    // 3. Projected Balance (Solde Théorique)
    // = Initial Balance (Bank) + Previous Unreconciled + Projected Income - Projected Expenses
    // Projected for Category = Max(Budget, Actual)
    let projectedIncome = 0;
    let projectedExpense = 0;

    for (const stat of categoryStats.values()) {
      const projectedAmt = Math.max(stat.budgeted, Math.abs(stat.spent));

      // Treat as income if type is 'income' OR if it's a transfer with positive actuals (net inflow)
      if (stat.type === 'income' || (stat.type === 'transfer' && stat.spent > 0)) {
        projectedIncome += projectedAmt;
      } else {
        projectedExpense += projectedAmt;
      }
    }

    const projectedBalance = initialBalance + previousUnreconciledSum + projectedIncome - projectedExpense;

    return {
      period,
      initialBalance,
      bankBalance,
      futureBalance,
      projectedBalance,
      totalIncome,
      totalExpense,
      projectedIncome,
      projectedExpense,
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
