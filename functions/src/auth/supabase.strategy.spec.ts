import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SupabaseStrategy } from './supabase.strategy';
import { SupabaseAuthGuard } from './supabase-auth.guard';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: () => () => undefined }));

const EMAIL = 'monkey@test.local';
const USER_ID = '11111111-2222-3333-4444-555555555555';

describe('Auth logs (no personal data)', () => {
  let output: string[];
  const spies: jest.SpyInstance[] = [];

  beforeEach(() => {
    output = [];
    const collect = (...args: unknown[]) => {
      output.push(args.map((a) => String(a)).join(' '));
    };
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      spies.push(jest.spyOn(console, method).mockImplementation(collect));
    }
    for (const method of [
      'log',
      'warn',
      'error',
      'debug',
      'verbose',
    ] as const) {
      spies.push(
        jest.spyOn(Logger.prototype, method).mockImplementation(collect),
      );
    }
  });

  afterEach(() => {
    spies.splice(0).forEach((s) => s.mockRestore());
  });

  const strategy = () =>
    new SupabaseStrategy({
      get: (key: string) =>
        key === 'SUPABASE_URL' ? 'http://127.0.0.1:54321' : undefined,
    } as unknown as ConfigService);

  it('does not log the email when a token is validated', () => {
    const result = strategy().validate({ sub: USER_ID, email: EMAIL });

    expect(result).toEqual({ id: USER_ID, email: EMAIL });
    expect(output.join('\n')).not.toContain(EMAIL);
  });

  it('does not log the email nor the token when validation fails', () => {
    const guard = new SupabaseAuthGuard();
    expect(() =>
      guard.handleRequest(null, false, { message: 'jwt malformed' }),
    ).toThrow();

    expect(output.join('\n')).toContain('jwt malformed');
    expect(output.join('\n')).not.toContain(EMAIL);
  });
});
