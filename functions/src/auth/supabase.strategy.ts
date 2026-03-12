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

    const isProduction = secret && !supabaseUrl?.includes('127.0.0.1');

    const strategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256', 'ES256'],
      ...(isProduction
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

    if (isProduction) {
      console.log(
        `[SupabaseStrategy] Using HS256 validation. Secret length: ${secret?.length}`,
      );
    } else {
      console.log(
        `[SupabaseStrategy] Using ES256/JWKS validation. URL: ${jwksUrl}`,
      );
    }
  }

  validate(payload: JwtPayload): { id: string; email: string } {
    console.log(
      `[SupabaseStrategy] Token validated for user: ${payload.sub} (${payload.email})`,
    );
    return { id: payload.sub, email: payload.email };
  }
}
