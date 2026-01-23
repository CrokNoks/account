import { Injectable, Logger } from '@nestjs/common';

/**
 * Shared logger service
 * Provides a consistent logging interface across all modules
 */
@Injectable()
export class LoggerService {
  /**
   * Get a logger instance for a specific context
   * @param context - The name of the context (usually class name)
   * @returns Logger instance
   */
  getLogger(context: string): Logger {
    return new Logger(context);
  }
}
