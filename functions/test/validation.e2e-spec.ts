import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks } from './e2e-app';
import { ConflictError } from '../src/shared/domain/errors';
import { RecurringTransaction } from '../src/recurring/domain/recurring-transaction.entity';

describe('Request body validation (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    for (const repo of ['categories', 'recurring', 'periods'] as const) {
      mocks[repo].save.mockResolvedValue(undefined);
    }
    mocks.periods.findAllByAccount.mockResolvedValue([]);
    mocks.budgets.replaceForPeriod.mockResolvedValue(undefined);
    mocks.periods.createWithBudgets.mockResolvedValue(undefined);
    mocks.recurring.findById.mockResolvedValue(
      RecurringTransaction.create({
        id: '00000000-0000-4000-8000-000000000114',
        accountId: '00000000-0000-4000-8000-000000000101',
        categoryId: null,
        description: 'Loyer',
        amount: BigInt(-85000),
        dayOfMonth: 5,
      }),
    );
  });

  describe('routes with a DTO class reject unknown fields with 400', () => {
    it.each([
      ['post', '/accounts'],
      ['patch', '/accounts/00000000-0000-4000-8000-000000000101'],
      ['post', '/accounts/00000000-0000-4000-8000-000000000101/shares'],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/categories/00000000-0000-4000-8000-000000000112',
      ],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/periods/00000000-0000-4000-8000-000000000113',
      ],
      [
        'put',
        '/00000000-0000-4000-8000-000000000101/periods/00000000-0000-4000-8000-000000000113/budgets',
      ],
      ['post', '/00000000-0000-4000-8000-000000000101/recurring'],
      ['post', '/00000000-0000-4000-8000-000000000101/transactions'],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
      ],
      ['post', '/00000000-0000-4000-8000-000000000101/periods'],
      ['post', '/00000000-0000-4000-8000-000000000101/categories'],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/recurring/00000000-0000-4000-8000-000000000114',
      ],
      ['post', '/00000000-0000-4000-8000-000000000101/tags'],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/tags/00000000-0000-4000-8000-000000000111',
      ],
      ['post', '/00000000-0000-4000-8000-000000000101/smart-rules'],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/smart-rules/00000000-0000-4000-8000-000000000115',
      ],
      ['post', '/00000000-0000-4000-8000-000000000101/savings-goals'],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/savings-goals/00000000-0000-4000-8000-000000000116',
      ],
      ['patch', '/preferences'],
      ['post', '/00000000-0000-4000-8000-000000000101/transactions/transfer'],
      ['post', '/00000000-0000-4000-8000-000000000101/transactions/bulk'],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/reporting/anomalies/ignore',
      ],
    ] as const)('%s %s', async (method, url) => {
      const res = await http()[method](url).set(auth()).send({ foo: 'bar' });

      expect(res.status).toBe(400);
      expect((res.body as { message: string[] }).message).toContain(
        'property foo should not exist',
      );
    });

    it('rejects an invalid share permission', () =>
      http()
        .post('/accounts/00000000-0000-4000-8000-000000000101/shares')
        .set(auth())
        .send({ email: 'guest@example.com', permission: 'admin' })
        .expect(400));
  });

  describe('bodies that used to be typed Omit<>/literal are now validated', () => {
    it('POST /:accountId/categories answers 400 for an invalid color and type', () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/categories')
        .set(auth())
        .send({ name: 'Courses', color: 'red', type: 'weird' })
        .expect(400));

    it('POST /:accountId/categories refuses an accountId in the body', () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/categories')
        .set(auth())
        .send({
          name: 'Courses',
          color: '#000000',
          type: 'expense',
          accountId: '00000000-0000-4000-8000-000000000102',
        })
        .expect(400));

    it('POST /:accountId/categories accepts the front payload', () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/categories')
        .set(auth())
        .send({ name: 'Courses', color: '#000000', type: 'expense' })
        .expect(201));

    it('POST /:accountId/periods answers 400 without budgets', () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/periods')
        .set(auth())
        .send({ startDate: '2026-03-01', endDate: '2026-03-31' })
        .expect(400));

    it('POST /:accountId/periods refuses an accountId in the body', () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/periods')
        .set(auth())
        .send({
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          budgets: [],
          accountId: '00000000-0000-4000-8000-000000000102',
        })
        .expect(400));

    it('POST /:accountId/periods accepts the front payload', () => {
      mocks.recurring.findAllByAccount.mockResolvedValue([]);
      mocks.categories.findById.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000019',
        accountId: '00000000-0000-4000-8000-000000000101',
      });
      return http()
        .post('/00000000-0000-4000-8000-000000000101/periods')
        .set(auth())
        .send({
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          budgets: [
            {
              categoryId: '00000000-0000-4000-8000-000000000019',
              amountAllocated: '10000',
            },
          ],
          injectRecurring: true,
        })
        .expect(201);
    });
  });

  describe('recurring amounts are integer cents (within ±(2^53 - 1))', () => {
    const base = '/00000000-0000-4000-8000-000000000101/recurring';
    const created = { description: 'Loyer', dayOfMonth: 5 };

    it.each([
      ['a decimal amount', '12.5'],
      ['an amount above 2^53 - 1', '9007199254740992'],
      ['a negative amount below -(2^53 - 1)', '-9007199254740992'],
      ['a huge amount', '99999999999999999999999'],
    ])('POST answers 400 without saving for %s', async (_, amount) => {
      await http()
        .post(base)
        .set(auth())
        .send({ ...created, amount })
        .expect(400);
      expect(mocks.recurring.save).not.toHaveBeenCalled();
    });

    it.each([
      ['a decimal amount', '12.5'],
      ['a huge amount', '99999999999999999999999'],
    ])('PATCH answers 400 without saving for %s', async (_, amount) => {
      await http()
        .patch(`${base}/00000000-0000-4000-8000-000000000114`)
        .set(auth())
        .send({ amount })
        .expect(400);
      expect(mocks.recurring.save).not.toHaveBeenCalled();
    });

    it('keeps the largest accepted amount (2^53 - 1) exactly on create and update', async () => {
      const max = '9007199254740991';
      const res = await http()
        .post(base)
        .set(auth())
        .send({ ...created, amount: max })
        .expect(201);
      expect((res.body as { amount: string }).amount).toBe(max);

      await http()
        .patch(`${base}/00000000-0000-4000-8000-000000000114`)
        .set(auth())
        .send({ amount: max })
        .expect(200);
      const calls = mocks.recurring.save.mock.calls as [RecurringTransaction][];
      expect(calls[calls.length - 1][0].amount.toString()).toBe(max);
    });
  });

  describe('other amounts are integer cents (within ±(2^53 - 1))', () => {
    const acc = '00000000-0000-4000-8000-000000000101';
    const bad = [
      ['a decimal amount', '12.5'],
      ['a scientific notation amount', '1e3'],
      ['a non numeric amount', 'abc'],
      ['an amount above 2^53 - 1', '9007199254740992'],
      ['a huge amount', '99999999999999999999'],
    ];
    const cat = '00000000-0000-4000-8000-000000000019';
    const cases: [string, 'post' | 'patch' | 'put', string, string, string][] =
      [
        ['accounts POST', 'post', '/accounts', 'initialBalance', 'name'],
        ['accounts PATCH', 'patch', `/accounts/${acc}`, 'initialBalance', ''],
        [
          'categories POST',
          'post',
          `/${acc}/categories`,
          'budget',
          'categorie',
        ],
        [
          'categories PATCH',
          'patch',
          `/${acc}/categories/00000000-0000-4000-8000-000000000112`,
          'budget',
          '',
        ],
        [
          'savings-goals POST',
          'post',
          `/${acc}/savings-goals`,
          'targetAmount',
          'goal',
        ],
        [
          'savings-goals PATCH targetAmount',
          'patch',
          `/${acc}/savings-goals/00000000-0000-4000-8000-000000000116`,
          'targetAmount',
          '',
        ],
        [
          'savings-goals PATCH currentAmount',
          'patch',
          `/${acc}/savings-goals/00000000-0000-4000-8000-000000000116`,
          'currentAmount',
          '',
        ],
      ];

    const payload = (kind: string, field: string, value: string) => {
      const extra: Record<string, unknown> =
        kind === 'name'
          ? { name: 'Courant' }
          : kind === 'categorie'
            ? { name: 'Courses', color: '#000000', type: 'expense' }
            : kind === 'goal'
              ? { name: 'Vacances' }
              : {};
      return { ...extra, [field]: value };
    };

    describe.each(cases)('%s', (_n, method, url, field, kind) => {
      it.each(bad)('answers 400 for %s', async (_, value) => {
        await http()
          [method](url)
          .set(auth())
          .send(payload(kind, field, value))
          .expect(400);
        for (const repo of ['accounts', 'categories', 'savingsGoals'] as const)
          expect(mocks[repo].save).not.toHaveBeenCalled();
      });
    });

    it.each([
      [
        'PUT budgets',
        'put',
        `/${acc}/periods/00000000-0000-4000-8000-000000000113/budgets`,
        false,
      ],
      ['POST period', 'post', `/${acc}/periods`, true],
    ] as const)(
      '%s answers 400 for a bad amountAllocated',
      async (_n, method, url, withDates) => {
        for (const [, amountAllocated] of bad) {
          await http()
            [method](url)
            .set(auth())
            .send({
              ...(withDates
                ? { startDate: '2026-03-01', endDate: '2026-03-31' }
                : {}),
              budgets: [{ categoryId: cat, amountAllocated }],
            })
            .expect(400);
        }
        expect(mocks.budgets.replaceForPeriod).not.toHaveBeenCalled();
        expect(mocks.periods.createWithBudgets).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['minAmount', '1.5'],
      ['maxAmount', '1.5'],
      ['minAmount', '1e3'],
      ['maxAmount', '9007199254740992'],
      ['minAmount', '-9007199254740992'],
      ['minAmount', '99999999999999999999'],
    ])('GET transactions answers 400 for %s=%s', async (field, value) => {
      await http()
        .get(`/${acc}/transactions`)
        .query({ [field]: value })
        .set(auth())
        .expect(400);
      expect(mocks.transactions.findAllByAccount).not.toHaveBeenCalled();
    });

    it('GET transactions still accepts negative integer bounds', async () => {
      mocks.transactions.findAllByAccount.mockResolvedValue({
        data: [],
        total: 0,
      });
      await http()
        .get(`/${acc}/transactions`)
        .query({ minAmount: '-5000', maxAmount: '9007199254740991' })
        .set(auth())
        .expect(200);
      const [[, options]] = mocks.transactions.findAllByAccount.mock.calls as [
        [string, { minAmount: bigint; maxAmount: bigint }],
      ];
      expect(options.minAmount).toBe(BigInt(-5000));
      expect(options.maxAmount).toBe(BigInt('9007199254740991'));
    });
  });

  describe('PATCH /:accountId/recurring/:id', () => {
    it('answers 404 for an unknown recurring transaction', async () => {
      mocks.recurring.findById.mockResolvedValue(null);

      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/recurring/00000000-0000-4000-8000-000000000199',
        )
        .set(auth())
        .send({ description: 'x' })
        .expect(404);
      expect(mocks.recurring.save).not.toHaveBeenCalled();
    });

    it('keeps the existing amount when the body has no amount', async () => {
      const res = await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/recurring/00000000-0000-4000-8000-000000000114',
        )
        .set(auth())
        .send({ description: 'Loyer appartement' })
        .expect(200);

      const [[saved]] = mocks.recurring.save.mock.calls as [
        RecurringTransaction,
      ][];
      expect(saved.description).toBe('Loyer appartement');
      expect(saved.amount).toBe(BigInt(-85000));
      expect((res.body as { amount: string }).amount).toBe('-85000');
    });

    it('updates the amount when provided', async () => {
      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/recurring/00000000-0000-4000-8000-000000000114',
        )
        .set(auth())
        .send({ amount: '-90000' })
        .expect(200);

      const [[saved]] = mocks.recurring.save.mock.calls as [
        RecurringTransaction,
      ][];
      expect(saved.amount).toBe(BigInt(-90000));
    });

    it('refuses to move the recurring transaction to another account', async () => {
      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/recurring/00000000-0000-4000-8000-000000000114',
        )
        .set(auth())
        .send({
          amount: '-90000',
          accountId: '00000000-0000-4000-8000-000000000102',
        })
        .expect(400);

      expect(mocks.recurring.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid amount and day of month', async () => {
      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/recurring/00000000-0000-4000-8000-000000000114',
        )
        .set(auth())
        .send({ amount: 'abc', dayOfMonth: 40 })
        .expect(400);
      expect(mocks.recurring.save).not.toHaveBeenCalled();
    });
  });
  describe('ids received in a body or a query must be UUIDs (400, no repository call)', () => {
    const tx = { date: '2026-03-01', description: 'CB', amount: '-100' };
    const bad = 'not-a-uuid';
    it.each([
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/transactions',
        { ...tx, savingsGoalId: bad },
      ],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/transactions',
        { ...tx, categoryId: bad },
      ],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/transactions',
        { ...tx, periodId: bad },
      ],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/transactions',
        { ...tx, tagIds: [bad] },
      ],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        { savingsGoalId: bad },
      ],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/transactions/bulk',
        { transactions: [{ ...tx, categoryId: bad }] },
      ],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/transactions/bulk',
        { ids: [bad], data: {} },
      ],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/transactions/bulk',
        { ids: [], data: { categoryId: bad } },
      ],
      [
        'delete',
        '/00000000-0000-4000-8000-000000000101/transactions/bulk',
        { ids: [bad] },
      ],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/transactions/transfer',
        {
          destinationAccountId: bad,
          date: '2026-03-01',
          description: 'x',
          amount: '100',
        },
      ],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/recurring',
        { categoryId: bad, description: 'x', amount: '-1', dayOfMonth: 5 },
      ],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/smart-rules',
        { pattern: 'x', categoryId: bad },
      ],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/smart-rules',
        { pattern: 'x', tagIds: [bad] },
      ],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/periods',
        {
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          budgets: [{ categoryId: bad, amountAllocated: '1' }],
        },
      ],
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/reporting/anomalies/ignore',
        { transactionIds: [bad], type: 'outlier' },
      ],
    ] as const)('%s %s %j', async (method, url, body) => {
      const res = await http()[method](url).set(auth()).send(body);

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/UUID/i);
      for (const repo of [
        'transactions',
        'categories',
        'tags',
        'savingsGoals',
        'periods',
      ] as const) {
        expect(mocks[repo].findById).not.toHaveBeenCalled();
        expect(mocks[repo].save).not.toHaveBeenCalled();
      }
    });

    it('GET /:accountId/transactions answers 400 for a malformed categoryId or periodId', async () => {
      await http()
        .get('/00000000-0000-4000-8000-000000000101/transactions')
        .query({ categoryId: bad })
        .set(auth())
        .expect(400);
      await http()
        .get('/00000000-0000-4000-8000-000000000101/transactions')
        .query({ periodId: bad })
        .set(auth())
        .expect(400);
    });
  });
  describe('unique violation raised by the repository', () => {
    it('POST /:accountId/tags answers 409 when the name already exists', async () => {
      mocks.tags.save.mockRejectedValue(
        new ConflictError('A tag with this name already exists'),
      );
      const res = await http()
        .post('/00000000-0000-4000-8000-000000000101/tags')
        .set(auth())
        .send({ name: 'Vacances', color: '#ff0000' })
        .expect(409);
      expect((res.body as { message: string }).message).toBe(
        'A tag with this name already exists',
      );
    });
  });

  describe('ids received in the query of reporting routes must be UUIDs (400, no repository call)', () => {
    const acc = '00000000-0000-4000-8000-000000000101';
    const ok = '00000000-0000-4000-8000-000000000113';
    const anyRepoCalled = () =>
      Object.values(mocks).some((repo) =>
        Object.values(repo).some((fn) => fn.mock.calls.length > 0),
      );

    it.each([
      `/${acc}/reporting/anomalies?periodId=not-a-uuid`,
      `/${acc}/reporting/tags-summary?periodId=not-a-uuid`,
      `/${acc}/reporting/tags/${ok}?periodId=not-a-uuid`,
      `/${acc}/periods/${ok}/reporting/comparison?compareWith=not-a-uuid`,
      `/${acc}/periods/${ok}/reporting/comparison`,
    ])('GET %s answers 400', async (url) => {
      jest.clearAllMocks();
      await http().get(url).set(auth()).expect(400);
      expect(anyRepoCalled()).toBe(false);
    });

    it('still accepts a valid periodId, or none', async () => {
      for (const url of [
        `/${acc}/reporting/anomalies?periodId=${ok}`,
        `/${acc}/reporting/anomalies`,
        `/${acc}/reporting/tags-summary`,
      ]) {
        const res = await http().get(url).set(auth());
        expect(res.status).not.toBe(400);
      }
    });
  });
});
