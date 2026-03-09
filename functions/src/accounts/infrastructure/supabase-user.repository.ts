import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { UserRepository } from '../domain/user.repository.interface';

@Injectable()
export class SupabaseUserRepository extends UserRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {
    super();
  }

  async findByEmail(email: string): Promise<{ id: string, email: string } | null> {
    const { data, error } = await this.supabase
      .from('app_users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch user by email: ${error.message}`);
    }

    return data;
  }
}
