import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient | null = null;

  constructor(private configService: ConfigService) { }

  getClient(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || 
                        this.configService.get<string>('VITE_SUPABASE_URL');

      // Use service role key for server-side operations
      const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing! Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
    return this.supabase;
  }
  getClientWithToken(token: string): SupabaseClient {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || 
                        this.configService.get<string>('VITE_SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('VITE_SUPABASE_ANON_KEY') || 
                        this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing! Required: SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
    }

    // Ensure token is properly formatted for Authorization header
    const formattedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    
    return createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: formattedToken },
      },
    });
  }
}
