import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SupabaseAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  // Logs only the failure reason (never the token nor any user data).
  handleRequest<TUser>(
    err: unknown,
    user: TUser | false,
    info?: { message?: string },
  ): TUser {
    if (err || !user) {
      this.logger.warn(
        `Authentication refused: ${info?.message ?? 'no valid token'}`,
      );
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user;
  }
}
