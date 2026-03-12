import { Module, Global, Scope } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import { Request } from 'express';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'SUPABASE_CLIENT',
      scope: Scope.REQUEST,
      inject: [ConfigService, REQUEST],
      useFactory: (configService: ConfigService, request: Request) => {
        const url = configService.get<string>('SUPABASE_URL');
        const key = configService.get<string>('SUPABASE_ANON_KEY');

        if (!url || !key) {
          throw new Error(
            'SUPABASE_URL and SUPABASE_ANON_KEY must be provided',
          );
        }

        const authHeader = request?.headers?.authorization;
        const options: SupabaseClientOptions<'public'> = {
          auth: {
            persistSession: false,
          },
        };

        if (authHeader?.startsWith('Bearer ')) {
          options.global = {
            headers: {
              Authorization: authHeader,
            },
          };
        }

        return createClient(url, key, options);
      },
    },
  ],
  exports: ['SUPABASE_CLIENT'],
})
export class SupabaseModule {}
