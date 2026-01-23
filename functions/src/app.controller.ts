import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Root controller for the application
 * Provides health check and status endpoints
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check endpoint
   * @returns API status message
   */
  @Get('health')
  getHealth(): { status: string } {
    return { status: this.appService.getHealth() };
  }

  /**
   * Root endpoint for testing
   * @returns Welcome message
   */
  @Get()
  getRoot(): { message: string } {
    return { message: 'Welcome to Account API' };
  }
}
