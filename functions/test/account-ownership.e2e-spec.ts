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
  id: '00000000-0000-4000-8000-000000000107',
  accountId,
  createdAt: now,
  updatedAt: now,
});

const fixtures = {
  transactions: (accountId: string) => ({
    ...base(accountId),
    categoryId: '00000000-0000-4000-8000-000000000012',
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
    categoryId: '00000000-0000-4000-8000-000000000012',
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
    url: '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000107',
    body: { notes: 'n' },
    writes: ['transactions.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE transactions/:id',
    repo: 'transactions',
    method: 'delete',
    url: '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000107',
    writes: ['transactions.delete'],
    okStatus: 204,
  },
  {
    name: 'PATCH recurring/:id',
    repo: 'recurring',
    method: 'patch',
    url: '/00000000-0000-4000-8000-000000000101/recurring/00000000-0000-4000-8000-000000000107',
    body: { description: 'n' },
    writes: ['recurring.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE recurring/:id',
    repo: 'recurring',
    method: 'delete',
    url: '/00000000-0000-4000-8000-000000000101/recurring/00000000-0000-4000-8000-000000000107',
    writes: ['recurring.delete'],
    okStatus: 200,
  },
  {
    name: 'PATCH categories/:id',
    repo: 'categories',
    method: 'patch',
    url: '/00000000-0000-4000-8000-000000000101/categories/00000000-0000-4000-8000-000000000107',
    body: { name: 'n' },
    writes: ['categories.save'],
    okStatus: 200,
  },
  {
    name: 'PATCH tags/:id',
    repo: 'tags',
    method: 'patch',
    url: '/00000000-0000-4000-8000-000000000101/tags/00000000-0000-4000-8000-000000000107',
    body: { name: 'n' },
    writes: ['tags.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE tags/:id',
    repo: 'tags',
    method: 'delete',
    url: '/00000000-0000-4000-8000-000000000101/tags/00000000-0000-4000-8000-000000000107',
    writes: ['tags.delete'],
    okStatus: 200,
  },
  {
    name: 'PATCH smart-rules/:id',
    repo: 'smartRules',
    method: 'patch',
    url: '/00000000-0000-4000-8000-000000000101/smart-rules/00000000-0000-4000-8000-000000000107',
    body: { priority: 2 },
    writes: ['smartRules.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE smart-rules/:id',
    repo: 'smartRules',
    method: 'delete',
    url: '/00000000-0000-4000-8000-000000000101/smart-rules/00000000-0000-4000-8000-000000000107',
    writes: ['smartRules.delete'],
    okStatus: 200,
  },
  {
    name: 'PATCH savings-goals/:id',
    repo: 'savingsGoals',
    method: 'patch',
    url: '/00000000-0000-4000-8000-000000000101/savings-goals/00000000-0000-4000-8000-000000000107',
    body: { name: 'n' },
    writes: ['savingsGoals.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE savings-goals/:id',
    repo: 'savingsGoals',
    method: 'delete',
    url: '/00000000-0000-4000-8000-000000000101/savings-goals/00000000-0000-4000-8000-000000000107',
    writes: ['savingsGoals.delete'],
    okStatus: 200,
  },
  {
    name: 'GET periods/:id',
    repo: 'periods',
    method: 'get',
    url: '/00000000-0000-4000-8000-000000000101/periods/00000000-0000-4000-8000-000000000107',
    writes: [],
    okStatus: 200,
  },
  {
    name: 'PATCH periods/:id',
    repo: 'periods',
    method: 'patch',
    url: '/00000000-0000-4000-8000-000000000101/periods/00000000-0000-4000-8000-000000000107',
    body: { isActive: false },
    writes: ['periods.save'],
    okStatus: 200,
  },
  {
    name: 'DELETE periods/:id',
    repo: 'periods',
    method: 'delete',
    url: '/00000000-0000-4000-8000-000000000101/periods/00000000-0000-4000-8000-000000000107',
    writes: ['periods.delete'],
    okStatus: 200,
  },
  {
    name: 'GET periods/:id/budgets',
    repo: 'periods',
    method: 'get',
    url: '/00000000-0000-4000-8000-000000000101/periods/00000000-0000-4000-8000-000000000107/budgets',
    writes: [],
    okStatus: 200,
  },
  {
    name: 'PUT periods/:id/budgets',
    repo: 'periods',
    method: 'put',
    url: '/00000000-0000-4000-8000-000000000101/periods/00000000-0000-4000-8000-000000000107/budgets',
    body: {
      budgets: [
        {
          categoryId: '00000000-0000-4000-8000-000000000040',
          amountAllocated: '100',
        },
      ],
    },
    writes: ['budgets.replaceForPeriod'],
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
      for (const fn of [
        'save',
        'delete',
        'replaceForPeriod',
        'createWithBudgets',
        'saveTransfer',
        'saveMany',
        'updateMany',
        'deleteMany',
      ]) {
        m[fn].mockResolvedValue(undefined);
      }
    }
    // Les écritures renvoient les lignes enregistrées : ici, celles reçues.
    mocks.transactions.save.mockImplementation((t: unknown) =>
      Promise.resolve(t),
    );
    mocks.transactions.saveMany.mockImplementation((l: unknown) =>
      Promise.resolve(l),
    );
    mocks.transactions.saveTransfer.mockImplementation(
      (d: unknown, c: unknown) => Promise.resolve([d, c]),
    );
    mocks.budgets.findAllByPeriod.mockResolvedValue([]);
    // Catégorie référencée par le PUT budgets : celle du compte de l'URL.
    mocks.categories.findById.mockResolvedValue({
      id: 'c',
      accountId: '00000000-0000-4000-8000-000000000101',
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
      ].findById.mockResolvedValue(
        fixtures[r.repo]('00000000-0000-4000-8000-000000000101'),
      );
      await send(r).expect(r.okStatus);
    });

    it('answers 404 without writing for an element of another account', async () => {
      mocks[r.repo].findById.mockResolvedValue(
        fixtures[r.repo]('00000000-0000-4000-8000-000000000102'),
      );
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
        .patch(
          '/00000000-0000-4000-8000-000000000101/categories/00000000-0000-4000-8000-000000000107',
        )
        .set(auth())
        .send({ name: 'n' })
        .expect(404);
      expect(mocks.categories.save).not.toHaveBeenCalled();
    });
  });

  describe('GET /:accountId/transactions?periodId=', () => {
    it('answers 404 for a period of another account', async () => {
      mocks.periods.findById.mockResolvedValue(
        fixtures.periods('00000000-0000-4000-8000-000000000102'),
      );
      await http()
        .get('/00000000-0000-4000-8000-000000000101/transactions')
        .query({ periodId: '00000000-0000-4000-8000-000000000041' })
        .set(auth())
        .expect(404);
      expect(mocks.transactions.findAllByAccount).not.toHaveBeenCalled();
    });
  });

  describe('reporting of a period of another account', () => {
    it.each([
      'periods/00000000-0000-4000-8000-000000000107/reporting/stats',
      'periods/00000000-0000-4000-8000-000000000107/reporting/budget-breakdown',
      'periods/00000000-0000-4000-8000-000000000107/reporting/comparison?compareWith=00000000-0000-4000-8000-000000000107',
      'periods/00000000-0000-4000-8000-000000000107/reporting/sankey',
      'reporting/tags-summary?periodId=00000000-0000-4000-8000-000000000107',
      'reporting/anomalies?periodId=00000000-0000-4000-8000-000000000107',
    ])(
      'GET /00000000-0000-4000-8000-000000000101/%s answers 404',
      async (path) => {
        mocks.periods.findById.mockResolvedValue(
          fixtures.periods('00000000-0000-4000-8000-000000000102'),
        );
        mocks.accounts.findById.mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000101',
          initialBalance: BigInt(0),
        });
        await http()
          .get(`/00000000-0000-4000-8000-000000000101/${path}`)
          .set(auth())
          .expect(404);
        expect(
          mocks.transactions.findAllByAccountUnpaginated,
        ).not.toHaveBeenCalled();
      },
    );

    it('GET reporting/tags/:tagId answers 404 with a period of another account', async () => {
      mocks.tags.findById.mockResolvedValue(
        fixtures.tags('00000000-0000-4000-8000-000000000101'),
      );
      mocks.periods.findById.mockResolvedValue(
        fixtures.periods('00000000-0000-4000-8000-000000000102'),
      );
      await http()
        .get(
          '/00000000-0000-4000-8000-000000000101/reporting/tags/00000000-0000-4000-8000-000000000107?periodId=00000000-0000-4000-8000-000000000107',
        )
        .set(auth())
        .expect(404);
    });
  });

  describe('GET /accounts/:id/shares', () => {
    const account = (ownerId: string) => ({
      id: '00000000-0000-4000-8000-000000000101',
      ownerId,
    });

    it('lists the shares for the owner', async () => {
      mocks.accounts.findById.mockResolvedValue(
        account('00000000-0000-4000-8000-000000000106'),
      );
      mocks.shares.findAllByAccount.mockResolvedValue([]);
      await http()
        .get('/accounts/00000000-0000-4000-8000-000000000101/shares')
        .set(auth())
        .expect(200, []);
    });

    it('answers 403 for someone who is not the owner', async () => {
      mocks.accounts.findById.mockResolvedValue(
        account('00000000-0000-4000-8000-000000000104'),
      );
      await http()
        .get('/accounts/00000000-0000-4000-8000-000000000101/shares')
        .set(auth())
        .expect(403);
      expect(mocks.shares.findAllByAccount).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown account', async () => {
      mocks.accounts.findById.mockResolvedValue(null);
      await http()
        .get('/accounts/00000000-0000-4000-8000-000000000199/shares')
        .set(auth())
        .expect(404);
      expect(mocks.shares.findAllByAccount).not.toHaveBeenCalled();
    });
  });
});
