import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

// Enhanced interfaces following TypeScript guidelines
interface DatabaseError {
  message: string;
  code?: string;
  details?: any;
  stack?: string;
}

interface ErrorContext {
  operation: string;
  entity?: string;
  userId?: string;
}

/**
 * Base service class with standardized error handling and logging
 * Provides common functionality for all service classes following AGENTS.md guidelines
 */
@Injectable()
export abstract class BaseService {
  protected readonly logger: Logger;
  protected readonly serviceName: string;

  constructor(
    protected readonly supabase: SupabaseService,
    name: string
  ) {
    this.logger = new Logger(name);
    this.serviceName = name;
  }

  /**
   * Enhanced error handling with proper typing and structured logging
   * @param error - The error object from database operations
   * @param context - Context information for structured logging
   * @throws Never - Always throws an appropriate HTTP exception
   */
  protected handleError(error: unknown, context: ErrorContext): never {
    const dbError = this.normalizeError(error);
    const logContext = this.buildLogContext(context);

    this.logger.error(`Failed to ${context.operation} in ${context.entity || 'database'}: ${dbError.message}`, {
      error: dbError,
      context: logContext,
      service: this.serviceName,
      timestamp: new Date().toISOString()
    });

    this.throwSpecificException(dbError, context);
  }

  /**
   * Normalizes error object to DatabaseError interface
   * @param error - Raw error from database operation
   * @returns Normalized error object
   */
  private normalizeError(error: unknown): DatabaseError {
    if (error instanceof Error) {
      return {
        message: error.message,
        code: (error as any).code,
        stack: error.stack
      };
    }

    if (typeof error === 'object' && error !== null) {
      return {
        message: String(error),
        code: (error as any).code,
        details: error
      };
    }

    return {
      message: String(error),
      stack: new Error().stack
    };
  }

  /**
   * Builds structured logging context
   * @param context - Error context information
   * @returns Structured context object
   */
  private buildLogContext(context: ErrorContext): Record<string, any> {
    const logContext: Record<string, any> = {
      operation: context.operation,
      service: this.serviceName,
      timestamp: new Date().toISOString()
    };

    if (context.entity) {
      logContext.entity = context.entity;
    }

    if (context.userId) {
      logContext.userId = context.userId;
    }

    return logContext;
  }

  /**
   * Maps database errors to appropriate HTTP exceptions
   * @param error - Normalized database error
   * @param context - Error context for decision making
   * @throws Never - Always throws an appropriate HTTP exception
   */
  private throwSpecificException(error: DatabaseError, context: ErrorContext): never {
    const errorCode = error.code;

    // Handle specific Supabase/PostgreSQL error codes
    switch (errorCode) {
      case 'PGRST116':
        throw new NotFoundException(`${context.entity} not found`);
      
      case 'PGRST301':
      case 'PGRST302':
        throw new BadRequestException(`Invalid request parameters for ${context.operation}`);
      
      case '23505':
        throw new BadRequestException(`Duplicate ${context.entity} entry`);
      
      case '23503':
      case '23514':
        throw new BadRequestException(`Foreign key constraint violation in ${context.operation}`);
      
      default:
        // Handle pattern-based error detection
        if (this.isDuplicateError(error.message)) {
          throw new BadRequestException(`Duplicate ${context.entity} entry`);
        }
        
        if (this.isNotFoundError(error.message)) {
          throw new NotFoundException(`${context.entity} not found`);
        }
        
        throw new InternalServerErrorException(`${context.operation} failed: ${error.message}`);
    }
  }

  /**
   * Checks if error message indicates duplicate entry
   * @param message - Error message string
   * @returns True if duplicate error
   */
  private isDuplicateError(message: string): boolean {
    const duplicatePatterns = ['duplicate', 'unique', 'already exists', 'violates unique constraint'];
    return duplicatePatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Checks if error message indicates not found
   * @param message - Error message string
   * @returns True if not found error
   */
  private isNotFoundError(message: string): boolean {
    const notFoundPatterns = ['not found', 'does not exist', 'no rows returned'];
    return notFoundPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Logs debug information with structured data
   * @param message - Debug message
   * @param data - Optional data to log
   */
  protected logDebug(message: string, data?: Record<string, any>): void {
    const logData = data ? { data, service: this.serviceName } : { service: this.serviceName };
    this.logger.debug(message, logData);
  }

  /**
   * Logs error information with structured data
   * @param message - Error message
   * @param error - Error object
   * @param context - Additional context
   */
  protected logError(message: string, error: DatabaseError, context?: ErrorContext): void {
    const logData = {
      error,
      context,
      service: this.serviceName,
      timestamp: new Date().toISOString()
    };
    
    this.logger.error(message, logData);
  }

  /**
   * Logs information with structured data
   * @param message - Info message
   * @param data - Optional data to log
   */
  protected logInfo(message: string, data?: Record<string, any>): void {
    const logData = data ? { data, service: this.serviceName } : { service: this.serviceName };
    this.logger.log(message, logData);
  }
}