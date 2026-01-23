import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { CacheService } from './cache.service';

/**
 * Shared module
 * Provides services and utilities shared across multiple feature modules
 */
@Module({
  providers: [LoggerService, CacheService],
  exports: [LoggerService, CacheService],
})
export class SharedModule {}
