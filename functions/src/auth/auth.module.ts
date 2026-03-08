import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { SupabaseStrategy } from './supabase.strategy';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Module({
  imports: [PassportModule, ConfigModule],
  providers: [SupabaseStrategy, SupabaseAuthGuard],
  exports: [SupabaseAuthGuard],
})
export class AuthModule {}
