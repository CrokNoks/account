import { Injectable, Logger } from '@nestjs/common';

/**
 * Root service for application
 * Handles health checks and basic API status
 */
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  /**
   * Returns a health check message with environment info
   * @returns Enhanced health status message
   */
  getHealth(): string {
    this.logger.log('Health check requested');
    return 'API is running';
  }

  /**
   * Get application version
   * @returns Application version
   */
  getVersion(): string {
    return '1.0.0';
  }

  /**
   * Get application environment
   * @returns Current environment
   */
  getEnvironment(): string {
    return process.env.NODE_ENV || 'development';
  }

  /**
   * Get application uptime
   * @returns Application uptime in milliseconds
   */
  getUptime(): number {
    return Math.floor(process.uptime() * 1000); // Convert to milliseconds
  }
}