import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = configService.get<string>('SUPABASE_URL');
    const secret = configService.get<string>('SUPABASE_JWT_SECRET');
    const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

    const strategyOptions: any = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256', 'ES256'],
    };

    // If a secret is provided, prefer HS256 validation (common for Supabase cloud)
    if (secret && !supabaseUrl?.includes('127.0.0.1')) {
      strategyOptions.secretOrKey = secret;
    } else {
      // Use JWKS for local or if no secret is provided (uses ES256)
      strategyOptions.secretOrKeyProvider = passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: jwksUrl,
      });
    }

    super(strategyOptions);
  }

  async validate(payload: any) {
    return { id: payload.sub, email: payload.email };
  }
}
