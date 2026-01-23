import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

/**
 * Base service class with standardized error handling and logging
 * Provides common functionality for all service classes
 */
@Injectable()
export abstract class BaseService {
  protected readonly logger: Logger

  constructor(
    protected readonly supabase: SupabaseService,
    serviceName: string
  ) {
    this.logger = new Logger(serviceName)
  }

  /**
   * Handles database errors and converts them to appropriate HTTP exceptions
   * @param error - The error object from database operations
   * @param context - Context description for logging
   * @param operation - The operation being performed
   * @throws Never - Always throws an exception
   */
  protected handleError(error: any, context: string, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = error?.code

    this.logger.error(`Failed to ${operation} in ${context}: ${errorMessage}`, error.stack)

    // Handle specific Supabase error codes
    switch (errorCode) {
      case 'PGRST116':
        throw new NotFoundException('Resource not found')
      case 'PGRST301':
      case 'PGRST302':
        throw new BadRequestException('Invalid request parameters')
      case '23505':
        throw new BadRequestException('Duplicate entry')
      case '23503':
        throw new BadRequestException('Foreign key constraint violation')
      case '23514':
        throw new BadRequestException('Check constraint violation')
      default:
        if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
          throw new BadRequestException('Duplicate entry')
        }
        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
          throw new NotFoundException('Resource not found')
        }
        throw new InternalServerErrorException(`${operation} failed`)
    }
  }

  /**
   * Logs debug information
   * @param message - Debug message
   * @param data - Optional data to log
   */
  protected logDebug(message: string, data?: any): void {
    if (data) {
      this.logger.debug(message, data)
    } else {
      this.logger.debug(message)
    }
  }

  /**
   * Logs error information
   * @param message - Error message
   * @param error - Error object with stack trace
   */
  protected logError(message: string, error?: any): void {
    if (error) {
      this.logger.error(message, error.stack || error)
    } else {
      this.logger.error(message)
    }
  }

  /**
   * Validates that a required parameter is present
   * @param value - Value to validate
   * @param name - Name of the parameter
   * @throws BadRequestException if value is missing
   */
  protected validateRequired(value: any, name: string): void {
    if (!value || (typeof value === 'string' && !value.trim())) {
      throw new BadRequestException(`${name} is required`)
    }
  }

  /**
   * Validates UUID format
   * @param value - Value to validate
   * @param name - Name of the parameter
   * @throws BadRequestException if value is not a valid UUID
   */
  protected validateUUID(value: string, name: string): void {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(`${name} must be a valid UUID`)
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(value)) {
      throw new BadRequestException(`${name} must be a valid UUID`)
    }
  }
}