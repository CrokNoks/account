import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) { }

  getClient(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = this.configService.get<string>('VITE_SUPABASE_URL') || this.configService.get<string>('SUPABASE_URL');

      const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
        this.configService.get<string>('VITE_SUPABASE_ANON_KEY') ||
        this.configService.get<string>('SUPABASE_KEY');

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing!');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
    return this.supabase;
  }
  getClientWithToken(token: string): SupabaseClient {
    const supabaseUrl = this.configService.get<string>('VITE_SUPABASE_URL') || this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('VITE_SUPABASE_ANON_KEY') || this.configService.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing!');
    }

    // Extract Bearer token if needed, or pass as is if already formatted
    // nestDataProvider sends "Bearer <token>", so we pass it directly to Authorization header
    return createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: token },
      },
    });
  }
}
