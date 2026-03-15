import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(SupabaseStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = configService.get<string>('SUPABASE_URL');
    const secret = configService.get<string>('SUPABASE_JWT_SECRET');
    const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

    // If we have a secret, we use HS256 validation (standard for Supabase)
    // If not, we try JWKS validation (only if we have a URL)
    const useHS256 = !!secret;

    const strategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256', 'ES256'],
      ...(useHS256
        ? { secretOrKey: secret }
        : {
            secretOrKeyProvider: passportJwtSecret({
              cache: true,
              rateLimit: true,
              jwksRequestsPerMinute: 5,
              jwksUri: jwksUrl,
            }),
          }),
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    super(strategyOptions as any);

    if (useHS256) {
      console.log(
        `[SupabaseStrategy] Using HS256 validation (Secret length: ${secret?.length})`,
      );
    } else {
      console.log(
        `[SupabaseStrategy] Using ES256/JWKS validation (JWKS URL: ${jwksUrl})`,
      );
    }
  }

  validate(payload: JwtPayload): { id: string; email: string } {
    if (!payload || !payload.sub) {
      this.logger.error('[SupabaseStrategy] Validation failed: invalid payload');
      return null;
    }
    
    console.log(
      `[SupabaseStrategy] Token validated for user: ${payload.sub} (${payload.email})`,
    );
    return { id: payload.sub, email: payload.email };
  }
}
