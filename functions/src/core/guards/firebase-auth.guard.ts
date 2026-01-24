import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import * as admin from 'firebase-admin';

/**
 * Firebase Authentication Guard with enhanced error handling and logging
 * Verifies Firebase ID tokens and attaches user data to request
 * Follows AGENTS.md guidelines for performance and code quality
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor() {}

  /**
   * Validates Firebase ID token from Authorization header
   * @param context - Execution context containing request
   * @returns True if token is valid, throws ForbiddenException otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    
    if (!token) {
      throw new ForbiddenException('Missing Authorization header');
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Attach user data to request for downstream use
      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        claims: decodedToken,
        token: token // Keep original token for debugging
      };
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ForbiddenException(`Invalid or expired token: ${errorMessage}`);
    }
  }

  /**
   * Extracts Bearer token from Authorization header
   * @param request - HTTP request object
   * @returns Token string or null if not found
   * @private
   */
  private extractToken(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }
}