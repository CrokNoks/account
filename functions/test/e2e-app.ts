import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AccountRepository } from '../src/accounts/domain/account.repository.interface';
import { AccountShareRepository } from '../src/accounts/domain/account-share.repository.interface';
import { UserRepository } from '../src/accounts/domain/user.repository.interface';
import { BudgetRepository } from '../src/budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../src/categories/domain/category.repository.interface';
import { PeriodRepository } from '../src/periods/domain/period.repository.interface';
import { RecurringTransactionRepository } from '../src/recurring/domain/recurring-transaction.repository.interface';
import { TagRepository } from '../src/tags/domain/tag.repository.interface';
import { TransactionRepository } from '../src/transactions/domain/transaction.repository.interface';
import { globalPipes } from '../src/shared/infrastructure/route-id.pipe';

// Doit correspondre à test/e2e-env.ts
const JWT_SECRET = 'e2e-secret';

export const USER = {
  id: '00000000-0000-4000-8000-000000000106',
  email: 'user@example.com',
};

export function token(
  payload: Record<string, unknown> = { sub: USER.id, email: USER.email },
  options: jwt.SignOptions = { expiresIn: '1h' },
  secret = JWT_SECRET,
): string {
  return jwt.sign(payload, secret, { algorithm: 'HS256', ...options });
}

export const auth = () => ({ Authorization: `Bearer ${token()}` });

/** Mock dont chaque méthode appelée est un jest.fn créé à la demande. */
export type Mocked = Record<string, jest.Mock>;

function mock(): Mocked {
  const fns: Mocked = {};
  return new Proxy(fns, {
    get(target, prop) {
      // Nest teste ces propriétés (promesse, hooks de cycle de vie) : ne pas les simuler.
      if (typeof prop !== 'string' || prop === 'then' || prop.startsWith('on'))
        return undefined;
      target[prop] ??= jest.fn();
      return target[prop];
    },
  });
}

export const REPOSITORIES = {
  accounts: AccountRepository,
  shares: AccountShareRepository,
  users: UserRepository,
  budgets: BudgetRepository,
  categories: CategoryRepository,
  periods: PeriodRepository,
  recurring: RecurringTransactionRepository,
  tags: TagRepository,
  transactions: TransactionRepository,
  savingsGoals: 'SavingsGoalRepository',
  preferences: 'UserPreferencesRepository',
  smartRules: 'SmartRuleRepository',
} as const;

export type Mocks = Record<keyof typeof REPOSITORIES, Mocked>;

export async function createE2EApp(): Promise<{
  app: INestApplication<App>;
  mocks: Mocks;
}> {
  const mocks = Object.fromEntries(
    Object.keys(REPOSITORIES).map((k) => [k, mock()]),
  ) as Mocks;

  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const [key, provider] of Object.entries(REPOSITORIES)) {
    builder = builder
      .overrideProvider(provider)
      .useValue(mocks[key as keyof Mocks]);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: false,
  });
  // Même configuration que createNestServer (src/main.ts)
  app.useGlobalPipes(...globalPipes());
  await app.init();
  return { app, mocks };
}
