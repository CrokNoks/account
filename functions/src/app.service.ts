import { Injectable, Logger } from '@nestjs/common';

/**
 * Root service for the application
 * Handles health checks and basic API status
 */
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  /**
   * Returns a health check message
   * @returns Health status message
   */
  getHealth(): string {
    this.logger.log('Health check requested');
    return 'API is running';
  }
}
