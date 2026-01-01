import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class BudgetsService {
  constructor(private readonly supabase: SupabaseService) { }

  async getBudgetsForPeriod(periodId: string, token: string) {
    const { data, error } = await this.supabase.getClientWithToken(token)
      .from('budget_instances')
      .select(`
        *,
        categories (name, color, type)
      `)
      .eq('period_id', periodId);

    if (error) throw new Error(error.message);
    return data;
  }

  // Not strictly needed if PeriodsService handles the transactional insert, 
  // but good to have for modularity if we insert them separately.
  async createMany(instances: any[], token: string) {
    const { data, error } = await this.supabase.getClientWithToken(token)
      .from('budget_instances')
      .insert(instances)
      .select();

    if (error) throw new Error(error.message);
    return data;
  }
}
