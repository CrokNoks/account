import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Budget service with enhanced error handling and validation
 * Follows AGENTS.md guidelines for performance and code quality
 */
@Injectable()
export class BudgetsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Gets budgets for a specific period with categories
   * @param periodId - Period ID
   * @param token - Authorization token
   * @returns Array of budgets with categories
   * @throws InternalServerErrorException if query fails
   */
  async getBudgetsForPeriod(periodId: string, token: string): Promise<any[]> {
    if (!this.validateUUID(periodId)) {
      throw new InternalServerErrorException('Invalid period ID format');
    }
    
    const client = this.supabase.getClientWithToken(token);
    const { data, error } = await client
      .from('budget_instances')
      .select(`
        *,
        categories (name, color, type)
      `)
      .eq('period_id', periodId);

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch budgets for period: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Creates multiple budget instances in bulk
   * Useful for transactional insertions when periods are created
   * @param instances - Array of budget instances to insert
   * @param token - Authorization token for Supabase client
   * @returns Array of created budget instances
   * @throws InternalServerErrorException if insertion fails
   */
  async createMany(instances: any[], token: string): Promise<any[]> {
    if (!instances || instances.length === 0) {
      return [];
    }

    const client = this.supabase.getClientWithToken(token);
    const { data, error } = await client
      .from('budget_instances')
      .insert(instances)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(`Failed to create budget instances: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Validates UUID format
   * @param uuid - UUID to validate
   * @returns True if UUID is valid
   */
  private validateUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') {
      return false;
    }
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}