import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { BaseService } from '../shared/base.service';

/**
 * Service for managing budget operations
 * Handles budget retrieval and creation from Supabase
 */
@Injectable()
export class BudgetsService extends BaseService {
  constructor(supabase: SupabaseService) {
    super(supabase, BudgetsService.name);
  }

  /**
   * Retrieves all budgets for a specific period
   * Includes related category information
   * @param periodId - The period ID to filter budgets
   * @param token - Authorization token for Supabase client
   * @returns Array of budget instances with category data
   * @throws InternalServerErrorException if query fails
   */
  async getBudgetsForPeriod(periodId: string, token: string): Promise<any[]> {
    this.validateUUID(periodId, 'periodId');
    this.logDebug(`Fetching budgets for period: ${periodId}`);

    const client = this.supabase.getClientWithToken(token);
    const { data, error } = await client
      .from('budget_instances')
      .select(
        `
        *,
        categories (name, color, type)
      `,
      )
      .eq('period_id', periodId);

    if (error) {
      this.handleError(error, 'BudgetsService.getBudgetsForPeriod', 'fetch budgets for period');
    }

    return data || [];
  }

  /**
   * Creates multiple budget instances in bulk
   * Useful for transactional insertions when periods are created
   * @param instances - Array of budget instances to insert
   * @param token - Authorization token for Supabase client
   * @returns Array of created budget instances
   * @throws InternalServerErrorException if insert fails
   */
  async createMany(instances: any[], token: string): Promise<any[]> {
    if (!instances || instances.length === 0) {
      return [];
    }

    this.logDebug(`Creating ${instances.length} budget instances`);

    const client = this.supabase.getClientWithToken(token);
    const { data, error } = await client
      .from('budget_instances')
      .insert(instances)
      .select();

    if (error) {
      this.handleError(error, 'BudgetsService.createMany', 'create budget instances');
    }

    return data || [];
  }
}
