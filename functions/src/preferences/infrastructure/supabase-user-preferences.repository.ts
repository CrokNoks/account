import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  UserPreferences,
  DashboardLayout,
} from '../domain/user-preferences.entity';
import { UserPreferencesRepository } from '../domain/user-preferences.repository.interface';

interface UserPreferencesRow {
  user_id: string;
  dashboard_layout: DashboardLayout;
  updated_at: string;
}

@Injectable()
export class SupabaseUserPreferencesRepository implements UserPreferencesRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findByUserId(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await this.supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .returns<UserPreferencesRow>()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.mapToDomain(data);
  }

  async save(preferences: UserPreferences): Promise<void> {
    const { error } = await this.supabase.from('user_preferences').upsert({
      user_id: preferences.userId,
      dashboard_layout: preferences.dashboardLayout,
      updated_at: preferences.updatedAt.toISOString(),
    });

    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: UserPreferencesRow): UserPreferences {
    return new UserPreferences({
      userId: row.user_id,
      dashboardLayout: row.dashboard_layout,
      updatedAt: new Date(row.updated_at),
    });
  }
}
