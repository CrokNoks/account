import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(SupabaseStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = configService.get<string>('SUPABASE_URL');
    const secret = configService.get<string>('SUPABASE_JWT_SECRET');
    const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

    const strategyOptions: any = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256', 'ES256'],
    };

    const isProduction = secret && !supabaseUrl?.includes('127.0.0.1');

    if (isProduction) {
      strategyOptions.secretOrKey = secret;
    } else {
      strategyOptions.secretOrKeyProvider = passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: jwksUrl,
      });
    }

    super(strategyOptions);

    if (isProduction) {
      this.logger.log('Using HS256 validation with secret');
    } else {
      this.logger.log(`Using ES256/JWKS validation with URL: ${jwksUrl}`);
    }
  }

  async validate(payload: any) {
    this.logger.log(`Token validated successfully for user: ${payload.sub}`);
    return { id: payload.sub, email: payload.email };
  }
}
