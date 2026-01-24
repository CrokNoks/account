import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

// Enhanced interfaces following TypeScript guidelines
interface HealthResponse {
  status: string;
  timestamp: string;
}

interface RootResponse {
  message: string;
  version: string;
  environment: string;
}

/**
 * Root controller for application
 * Provides health check and status endpoints
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check endpoint
   * @returns Enhanced health status with timestamp
   */
  @Get('health')
  getHealth(): HealthResponse {
    return { 
      status: this.appService.getHealth(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Root endpoint for testing
   * @returns Enhanced welcome message with version info
   */
  @Get()
  getRoot(): RootResponse {
    return { 
      message: 'Welcome to Account API',
      version: this.appService.getVersion(),
      environment: this.appService.getEnvironment(),
    };
  }
}