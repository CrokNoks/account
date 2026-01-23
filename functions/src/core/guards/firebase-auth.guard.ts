import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import * as admin from 'firebase-admin'

/**
 * Firebase Authentication Guard
 * Verifies Firebase ID tokens and attaches user data to request
 * @class FirebaseAuthGuard
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  /**
   * Validates Firebase ID token from Authorization header
   * @param context - Execution context containing the request
   * @returns True if token is valid, throws ForbiddenException otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = this.extractToken(request)

    if (!token) {
      throw new ForbiddenException('Missing Authorization header')
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token)
      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        claims: decodedToken,
      }
      return true
    } catch (error) {
      throw new ForbiddenException('Invalid or expired token')
    }
  }

  /**
   * Extract Bearer token from Authorization header
   * @param request - HTTP request object
   * @returns Token string or null if not found
   * @private
   */
  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization
    if (!authHeader) return null

    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null
    }

    return parts[1]
  }
}
