import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks } from './e2e-app';

/**
 * Un élément atteint par `:id` sous `/:accountId/...` doit appartenir au compte
 * de l'URL. Inexistant ou d'un autre compte : même 404, aucune écriture.
 */
const now = new Date('2026-01-01T00:00:00.000Z');
const base = (accountId: string) => ({
  id: 'x1',
  accountId,
  createdAt: now,
  updatedAt: now,
});

const fixtures = {
  transactions: (accountId: string) => ({
    ...base(accountId),
    categoryId: 'cat-1',
    periodId: null,
    date: now,
    description: 'tx',
    amount: BigInt(-100),
    reconciled: false,
    pending: false,
    tagIds: [],
  }),
  recurring: (accountId: string) => ({
    ...base(accountId),
    categoryId: 'cat-1',
    description: 'loyer',
    amount: BigInt(-50000),
    dayOfMonth: 5,
  }),
  categories: (accountId: string | null) => ({
    ...base(accountId as string),
    accountId,
    name: 'Courses',
    description: null,
    color: '#111111',
    type: 'expense',
    budget: null,
  }),
  tags: (accountId: string) => ({
    ...base(accountId),
    name: 'Vacances',
    color: '#111111',
  }),
  smartRules: (accountId: string) => ({
    ...base(accountId),
    pattern: 'carrefour',
    categoryId: null,
    tagIds: [],
    priority: 0,
    updatePriority: jest.fn(),
  }),
  savingsGoals: (accountId: string) => ({
    ...base(accountId),
    name: 'Voyage',
    targetAmount: BigInt(100000),
    currentAmount: BigInt(0),
    deadline: null,
    color: '#3b82f6',
  }),
  periods: (accountId: string) => ({
    ...base(accountId),
    startDate: now,
    endDate: new Date('2026-01-31T00:00:00.000Z'),
    isActive: true,
  }),
};

type Method = 'get' | 'patch' | 'put' | 'delete';
interface Route {
  name: string;
  repo: keyof typeof fixtures;
  method: Method;
  url: string;
  body?: Record<string, unknown>;
  writes: string[]; // mocks[repo|other][method] qui ne doivent pas être appelés
  okStatus: number;
}

const routes: Route[] = [
  {
    name: 'PATCH transactions/:id',
    repo: 'transactions',
    method: 'patch',
    url: '/acc-1/transactions/x1',
    body: { notes: 'n' },
    writes: ['transactions.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE transactions/:id',
    repo: 'transactions',
    method: 'delete',
    url: '/acc-1/transactions/x1',
    writes: ['transactions.delete'],
    okStatus: 204,
  },
  {
    name: 'PATCH recurring/:id',
    repo: 'recurring',
    method: 'patch',
    url: '/acc-1/recurring/x1',
    body: { description: 'n' },
    writes: ['recurring.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE recurring/:id',
    repo: 'recurring',
    method: 'delete',
    url: '/acc-1/recurring/x1',
    writes: ['recurring.delete'],
    okStatus: 200,
  },
  {
    name: 'PATCH categories/:id',
    repo: 'categories',
    method: 'patch',
    url: '/acc-1/categories/x1',
    body: { name: 'n' },
    writes: ['categories.save'],
    okStatus: 200,
  },
  {
    name: 'PATCH tags/:id',
    repo: 'tags',
    method: 'patch',
    url: '/acc-1/tags/x1',
    body: { name: 'n' },
    writes: ['tags.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE tags/:id',
    repo: 'tags',
    method: 'delete',
    url: '/acc-1/tags/x1',
    writes: ['tags.delete'],
    okStatus: 200,
  },
  {
    name: 'PATCH smart-rules/:id',
    repo: 'smartRules',
    method: 'patch',
    url: '/acc-1/smart-rules/x1',
    body: { priority: 2 },
    writes: ['smartRules.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE smart-rules/:id',
    repo: 'smartRules',
    method: 'delete',
    url: '/acc-1/smart-rules/x1',
    writes: ['smartRules.delete'],
    okStatus: 200,
  },
  {
    name: 'PATCH savings-goals/:id',
    repo: 'savingsGoals',
    method: 'patch',
    url: '/acc-1/savings-goals/x1',
    body: { name: 'n' },
    writes: ['savingsGoals.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE savings-goals/:id',
    repo: 'savingsGoals',
    method: 'delete',
    url: '/acc-1/savings-goals/x1',
    writes: ['savingsGoals.delete'],
    okStatus: 200,
  },
  {
    name: 'GET periods/:id',
    repo: 'periods',
    method: 'get',
    url: '/acc-1/periods/x1',
    writes: [],
    okStatus: 200,
  },
  {
    name: 'PATCH periods/:id',
    repo: 'periods',
    method: 'patch',
    url: '/acc-1/periods/x1',
    body: { isActive: false },
    writes: ['periods.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE periods/:id',
    repo: 'periods',
    method: 'delete',
    url: '/acc-1/periods/x1',
    writes: ['periods.delete'],
    okStatus: 200,
  },
  {
    name: 'GET periods/:id/budgets',
    repo: 'periods',
    method: 'get',
    url: '/acc-1/periods/x1/budgets',
    writes: [],
    okStatus: 200,
  },
  {
    name: 'PUT periods/:id/budgets',
    repo: 'periods',
    method: 'put',
    url: '/acc-1/periods/x1/budgets',
    body: { budgets: [{ categoryId: 'c', amountAllocated: '100' }] },
    writes: ['budgets.deleteAllByPeriod', 'budgets.saveBulk'],
    okStatus: 200,
  },
];

describe('Account ownership of :id routes (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });
  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    for (const m of Object.values(mocks)) {
      for (const fn of ['save', 'delete', 'saveBulk', 'deleteAllByPeriod']) {
        m[fn].mockResolvedValue(undefined);
      }
    }
    mocks.budgets.findAllByPeriod.mockResolvedValue([]);
    // Catégorie référencée par le PUT budgets : celle du compte de l'URL.
    mocks.categories.findById.mockResolvedValue({
      id: 'c',
      accountId: 'acc-1',
    });
  });

  const send = (r: Route) => {
    const req = http()[r.method](r.url).set(auth());
    return r.body ? req.send(r.body) : req;
  };
  const expectNoWrite = (r: Route) => {
    for (const w of r.writes) {
      const [repo, fn] = w.split('.');
      expect(mocks[repo as keyof Mocks][fn]).not.toHaveBeenCalled();
    }
  };

  describe.each(routes)('$name', (r) => {
    it('works on an element of the account of the URL', async () => {
      mocks[
        r.repo === 'periods' ? 'periods' : r.repo
      ].findById.mockResolvedValue(fixtures[r.repo]('acc-1'));
      await send(r).expect(r.okStatus);
    });

    it('answers 404 without writing for an element of another account', async () => {
      mocks[r.repo].findById.mockResolvedValue(fixtures[r.repo]('acc-other'));
      const res = await send(r).expect(404);
      expectNoWrite(r);
      mocks[r.repo].findById.mockResolvedValue(null);
      const unknown = await send(r).expect(404);
      // même réponse : l'existence n'est pas révélée
      expect((res.body as { error: string }).error).toBe(
        (unknown.body as { error: string }).error,
      );
      expect((res.body as { message: string }).message).toBe(
        (unknown.body as { message: string }).message,
      );
      expectNoWrite(r);
    });
  });

  describe('categories', () => {
    it('refuses to modify a global category (accountId null)', async () => {
      mocks.categories.findById.mockResolvedValue(fixtures.categories(null));
      await http()
        .patch('/acc-1/categories/x1')
        .set(auth())
        .send({ name: 'n' })
        .expect(404);
      expect(mocks.categories.save).not.toHaveBeenCalled();
    });
  });

  describe('GET /:accountId/transactions?periodId=', () => {
    it('answers 404 for a period of another account', async () => {
      mocks.periods.findById.mockResolvedValue(fixtures.periods('acc-other'));
      await http()
        .get('/acc-1/transactions')
        .query({ periodId: 'x1' })
        .set(auth())
        .expect(404);
      expect(mocks.transactions.findAllByAccount).not.toHaveBeenCalled();
    });
  });

  describe('reporting of a period of another account', () => {
    it.each([
      'periods/x1/reporting/stats',
      'periods/x1/reporting/budget-breakdown',
      'periods/x1/reporting/comparison?compareWith=x1',
      'periods/x1/reporting/sankey',
      'periods/x1/reporting/ai-insights',
      'reporting/tags-summary?periodId=x1',
      'reporting/anomalies?periodId=x1',
    ])('GET /acc-1/%s answers 404', async (path) => {
      mocks.periods.findById.mockResolvedValue(fixtures.periods('acc-other'));
      mocks.accounts.findById.mockResolvedValue({
        id: 'acc-1',
        initialBalance: BigInt(0),
        description: null,
      });
      await http().get(`/acc-1/${path}`).set(auth()).expect(404);
      expect(
        mocks.transactions.findAllByAccountUnpaginated,
      ).not.toHaveBeenCalled();
    });

    it('GET reporting/tags/:tagId answers 404 with a period of another account', async () => {
      mocks.tags.findById.mockResolvedValue(fixtures.tags('acc-1'));
      mocks.periods.findById.mockResolvedValue(fixtures.periods('acc-other'));
      await http()
        .get('/acc-1/reporting/tags/x1?periodId=x1')
        .set(auth())
        .expect(404);
    });
  });

  describe('GET /accounts/:id/shares', () => {
    const account = (ownerId: string) => ({ id: 'acc-1', ownerId });

    it('lists the shares for the owner', async () => {
      mocks.accounts.findById.mockResolvedValue(account('user-1'));
      mocks.shares.findAllByAccount.mockResolvedValue([]);
      await http().get('/accounts/acc-1/shares').set(auth()).expect(200, []);
    });

    it('answers 403 for someone who is not the owner', async () => {
      mocks.accounts.findById.mockResolvedValue(account('someone-else'));
      await http().get('/accounts/acc-1/shares').set(auth()).expect(403);
      expect(mocks.shares.findAllByAccount).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown account', async () => {
      mocks.accounts.findById.mockResolvedValue(null);
      await http().get('/accounts/nope/shares').set(auth()).expect(404);
      expect(mocks.shares.findAllByAccount).not.toHaveBeenCalled();
    });
  });
});
