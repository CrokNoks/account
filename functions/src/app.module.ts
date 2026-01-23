import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { SupabaseModule } from './supabase/supabase.module';
import { BudgetsModule } from './budgets/budgets.module';
import { PeriodsModule } from './periods/periods.module';
import { TransactionsModule } from './transactions/transactions.module';

/**
 * Root module of the application
 * Imports all feature modules and configures global services
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve(process.cwd(), '../.env'),
      isGlobal: true,
    }),
    CoreModule,
    SharedModule,
    SupabaseModule,
    BudgetsModule,
    PeriodsModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    },
  ],
})
export class AppModule {}
