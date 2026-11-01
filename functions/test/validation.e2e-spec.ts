import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks } from './e2e-app';
import { ConflictError } from '../src/shared/domain/errors';
import {
  Category,
  CategoryType,
} from '../src/categories/domain/category.entity';
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
    jest.resetAllMocks();
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
      ];

    const payload = (kind: string, field: string, value: string) => {
      const extra: Record<string, unknown> =
        kind === 'name' ? { name: 'Courant' } : {};
      return { ...extra, [field]: value };
    };

    describe.each(cases)('%s', (_n, method, url, field, kind) => {
      it.each(bad)('answers 400 for %s', async (_, value) => {
        await http()
          [method](url)
          .set(auth())
          .send(payload(kind, field, value))
          .expect(400);
        for (const repo of ['accounts', 'categories'] as const)
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

  describe('dates must exist on the calendar (400, nothing saved)', () => {
    const acc = '00000000-0000-4000-8000-000000000101';
    const tx = '00000000-0000-4000-8000-000000000111';
    const cat = '00000000-0000-4000-8000-000000000019';
    const impossible = [
      '2026-02-30',
      '2026-04-31',
      '2026-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-02-30T10:00:00Z',
    ];
    const periodBody = (startDate: string, endDate: string) => ({
      startDate,
      endDate,
      budgets: [{ categoryId: cat, amountAllocated: '1000' }],
    });
    const cases: [string, 'post' | 'patch', string, (d: string) => object][] = [
      [
        'transactions POST',
        'post',
        `/${acc}/transactions`,
        (date) => ({ date, description: 'x', amount: '-100' }),
      ],
      [
        'transactions PATCH',
        'patch',
        `/${acc}/transactions/${tx}`,
        (date) => ({ date }),
      ],
      [
        'transactions bulk',
        'post',
        `/${acc}/transactions/bulk`,
        (date) => ({
          transactions: [{ date, description: 'x', amount: '-100' }],
        }),
      ],
      [
        'transfer',
        'post',
        `/${acc}/transactions/transfer`,
        (date) => ({
          destinationAccountId: '00000000-0000-4000-8000-000000000102',
          date,
          amount: '100',
        }),
      ],
      [
        'periods POST startDate',
        'post',
        `/${acc}/periods`,
        (d) => periodBody(d, '2026-03-31'),
      ],
      [
        'periods POST endDate',
        'post',
        `/${acc}/periods`,
        (d) => periodBody('2026-03-01', d),
      ],
      [
        'periods PATCH startDate',
        'patch',
        `/${acc}/periods/00000000-0000-4000-8000-000000000113`,
        (startDate) => ({ startDate }),
      ],
      [
        'periods PATCH endDate',
        'patch',
        `/${acc}/periods/00000000-0000-4000-8000-000000000113`,
        (endDate) => ({ endDate }),
      ],
    ];

    describe.each(cases)('%s', (_n, method, url, body) => {
      it.each(impossible)('answers 400 for %s', async (date) => {
        await http()[method](url).set(auth()).send(body(date)).expect(400);
        expect(mocks.transactions.save).not.toHaveBeenCalled();
        expect(mocks.periods.createWithBudgets).not.toHaveBeenCalled();
      });
    });

    it.each(['startDate', 'endDate'])(
      'GET transactions answers 400 for an impossible %s',
      async (field) => {
        for (const date of impossible) {
          await http()
            .get(`/${acc}/transactions`)
            .query({ [field]: date })
            .set(auth())
            .expect(400);
        }
        expect(mocks.transactions.findAllByAccount).not.toHaveBeenCalled();
      },
    );

    it('still accepts 29 February of a leap year, and dates with time/zone', async () => {
      mocks.transactions.findAllByAccount.mockResolvedValue({
        data: [],
        total: 0,
      });
      for (const date of [
        '2028-02-29',
        '2026-10-15T23:30:00-05:00',
        '2026-03-01T00:00:00.000Z',
      ]) {
        await http()
          .get(`/${acc}/transactions`)
          .query({ startDate: date })
          .set(auth())
          .expect(200);
      }
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
  describe('savingsGoalId is no longer accepted on transactions (400, no write)', () => {
    const goal = '00000000-0000-4000-8000-000000000116';
    it.each([
      [
        'post',
        '/00000000-0000-4000-8000-000000000101/transactions',
        { date: '2026-03-01', description: 'CB', amount: '-100' },
      ],
      [
        'patch',
        '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        {},
      ],
    ] as const)(
      '%s %s with a valid savingsGoalId',
      async (method, url, body) => {
        await http()
          [method](url)
          .set(auth())
          .send({ ...body, savingsGoalId: goal })
          .expect(400);
        expect(mocks.transactions.save).not.toHaveBeenCalled();
      },
    );
  });
  describe('null on a field that cannot be null answers 400, nothing is written', () => {
    const acc = '00000000-0000-4000-8000-000000000101';
    const id = '00000000-0000-4000-8000-000000000111';
    const cat = '00000000-0000-4000-8000-000000000112';
    const per = '00000000-0000-4000-8000-000000000113';
    const rec = '00000000-0000-4000-8000-000000000114';
    const rule = '00000000-0000-4000-8000-000000000115';

    const routes: [string, string, string[]][] = [
      [
        `/${acc}/transactions/${id}`,
        'transaction',
        [
          'date',
          'amount',
          'description',
          'reconciled',
          'pending',
          'metadata',
          'tagIds',
        ],
      ],
      [`/accounts/${acc}`, 'account', ['name', 'initialBalance']],
      [`/${acc}/categories/${cat}`, 'category', ['name', 'color', 'type']],
      [`/${acc}/tags/${id}`, 'tag', ['name', 'color']],
      [
        `/${acc}/recurring/${rec}`,
        'recurring',
        ['description', 'amount', 'dayOfMonth'],
      ],
      [
        `/${acc}/smart-rules/${rule}`,
        'smart rule',
        ['pattern', 'tagIds', 'priority'],
      ],
      [
        `/${acc}/periods/${per}`,
        'period',
        ['startDate', 'endDate', 'isActive'],
      ],
    ];
    const cases = routes.flatMap(([url, name, fields]) =>
      fields.map((field) => [name, field, url] as const),
    );

    const expectNothingWritten = () => {
      for (const repo of Object.values(mocks)) {
        for (const [fn, spy] of Object.entries(repo)) {
          if (/^(save|update|delete|replace)/.test(fn)) {
            expect(spy).not.toHaveBeenCalled();
          }
        }
      }
    };

    it.each(cases)('PATCH %s: %s null', async (_name, field, url) => {
      const res = await http()
        .patch(url)
        .set(auth())
        .send({ [field]: null });

      expect(res.status).toBe(400);
      expectNothingWritten();
    });

    const tx = { date: '2026-03-01', description: 'x', amount: '-100' };
    it.each([
      ['transactions', `/${acc}/transactions`, { ...tx, reconciled: null }],
      ['transactions', `/${acc}/transactions`, { ...tx, pending: null }],
      ['transactions', `/${acc}/transactions`, { ...tx, metadata: null }],
      ['transactions', `/${acc}/transactions`, { ...tx, tagIds: null }],
      [
        'transactions/bulk line',
        `/${acc}/transactions/bulk`,
        { transactions: [{ ...tx, reconciled: null }] },
      ],
      [
        'transactions/bulk line',
        `/${acc}/transactions/bulk`,
        { transactions: [{ ...tx, tagIds: null }] },
      ],
      [
        'smart-rules',
        `/${acc}/smart-rules`,
        { pattern: 'p', categoryId: null, tagIds: null },
      ],
      [
        'smart-rules',
        `/${acc}/smart-rules`,
        { pattern: 'p', categoryId: null, priority: null },
      ],
      [
        'periods',
        `/${acc}/periods`,
        {
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          budgets: [],
          injectRecurring: null,
        },
      ],
      ['accounts', '/accounts', { name: 'A', initialBalance: null }],
      ['tags', `/${acc}/tags`, { name: 'T', color: null }],
    ])(
      'POST %s with null on a required-or-defaulted field',
      async (_n, url, body) => {
        const res = await http().post(url).set(auth()).send(body);

        expect(res.status).toBe(400);
        expectNothingWritten();
      },
    );

    it('PATCH categories: description null removes the value, absent keeps it', async () => {
      const existing = {
        id: cat,
        accountId: acc,
        name: 'Courses',
        description: 'Alimentation',
        color: '#000000',
        type: 'expense',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mocks.categories.findById.mockResolvedValueOnce(existing);

      const res = await http()
        .patch(`/${acc}/categories/${cat}`)
        .set(auth())
        .send({ description: null })
        .expect(200);
      expect(mocks.categories.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ description: null }),
      );
      expect(res.body).not.toHaveProperty('budget');

      mocks.categories.findById.mockResolvedValueOnce(existing);
      await http()
        .patch(`/${acc}/categories/${cat}`)
        .set(auth())
        .send({ name: 'Autre' })
        .expect(200);
      expect(mocks.categories.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          name: 'Autre',
          description: 'Alimentation',
        }),
      );
    });

    // Le plafond de catégorie n'existe plus (le budget est celui de la période).
    it.each([
      ['post', `/${acc}/categories`],
      ['patch', `/${acc}/categories/${cat}`],
    ] as const)(
      '%s categories with a budget answers 400',
      async (method, url) => {
        const res = await http()
          [method](url)
          .set(auth())
          .send({
            name: 'Courses',
            color: '#000000',
            type: 'expense',
            budget: '5000',
          });

        expect(res.status).toBe(400);
        expect((res.body as { message: string[] }).message).toContain(
          'property budget should not exist',
        );
        expectNothingWritten();
      },
    );

    it.each(['reconciled', 'pending', 'tagIds'])(
      'PATCH transactions/bulk data.%s null',
      async (field) => {
        const res = await http()
          .patch(`/${acc}/transactions/bulk`)
          .set(auth())
          .send({ ids: [id], data: { [field]: null } });

        expect(res.status).toBe(400);
        expectNothingWritten();
      },
    );

    it('PATCH preferences: a widget visibility set to null', async () => {
      const res = await http()
        .patch('/preferences')
        .set(auth())
        .send({ widgets: [{ id: 'w', width: 1, desktopVisible: null }] });

      expect(res.status).toBe(400);
      expectNothingWritten();
    });

    it.each([
      ['transactions', `/${acc}/transactions/${id}`, 'categoryId'],
      ['transactions', `/${acc}/transactions/${id}`, 'periodId'],
      ['transactions', `/${acc}/transactions/${id}`, 'notes'],
      ['transactions/bulk', `/${acc}/transactions/bulk`, 'categoryId'],
      ['recurring', `/${acc}/recurring/${rec}`, 'categoryId'],
      ['smart-rules', `/${acc}/smart-rules/${rule}`, 'categoryId'],
    ])(
      'null stays accepted where it means "none": %s %s',
      async (_n, url, f) => {
        const body = url.endsWith('/bulk')
          ? { ids: [id], data: { [f]: null } }
          : { [f]: null };
        const res = await http().patch(url).set(auth()).send(body);
        expect(res.status).not.toBe(400);
      },
    );
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

  describe('invalid text and calendar inputs answer 400, not 500 or 201', () => {
    const acc = '00000000-0000-4000-8000-000000000101';
    const tx = '00000000-0000-4000-8000-000000000111';
    const cat = '00000000-0000-4000-8000-000000000112';
    const tag = '00000000-0000-4000-8000-000000000111';
    const rec = '00000000-0000-4000-8000-000000000114';

    it.each([
      '',
      '?year=2026',
      '?month=5',
      '?year=abc&month=5',
      '?year=2026&month=13',
      '?year=2026&month=0',
      '?year=2026&month=1.5',
      '?year=99999999&month=5',
      '?year=1800&month=5',
    ])('GET reporting/calendar%s answers 400', async (qs) => {
      await http()
        .get(`/${acc}/reporting/calendar${qs}`)
        .set(auth())
        .expect(400);
    });

    it('GET reporting/calendar still accepts a valid month', async () => {
      mocks.transactions.findAllByAccountUnpaginated.mockResolvedValue([]);
      mocks.recurring.findAllByAccount.mockResolvedValue([]);
      const res = await http()
        .get(`/${acc}/reporting/calendar?year=2026&month=5`)
        .set(auth());
      expect(res.status).toBe(200);
    });

    const long = (n: number) => 'x'.repeat(n);
    const cases: [string, 'post' | 'patch', string, object][] = [
      ['account name', 'post', '/accounts', { name: long(256) }],
      ['account name', 'patch', `/accounts/${acc}`, { name: long(256) }],
      [
        'category name',
        'post',
        `/${acc}/categories`,
        { name: long(256), color: '#000000', type: 'expense' },
      ],
      ['tag name', 'post', `/${acc}/tags`, { name: long(51) }],
      ['tag name', 'patch', `/${acc}/tags/${tag}`, { name: long(51) }],
      [
        'transaction description',
        'post',
        `/${acc}/transactions`,
        { date: '2026-03-01', description: long(256), amount: '-100' },
      ],
      [
        'transaction description',
        'patch',
        `/${acc}/transactions/${tx}`,
        { description: long(256) },
      ],
      [
        'recurring description',
        'post',
        `/${acc}/recurring`,
        { description: long(256), amount: '-100', dayOfMonth: 5 },
      ],
      [
        'recurring description',
        'patch',
        `/${acc}/recurring/${rec}`,
        { description: long(256) },
      ],
      [
        'transfer description',
        'post',
        `/${acc}/transactions/transfer`,
        {
          destinationAccountId: '00000000-0000-4000-8000-000000000102',
          date: '2026-03-01',
          description: long(256),
          amount: '100',
        },
      ],
      [
        'tag color (varchar(7))',
        'post',
        `/${acc}/tags`,
        { name: 'ok', color: '#12345678' },
      ],
    ];
    it.each(cases)(
      '%s (%s) beyond the database limit answers 400',
      async (_n, method, url, body) => {
        await http()[method](url).set(auth()).send(body).expect(400);
      },
    );

    describe('PATCH category name length', () => {
      // Mocks propres au test : la catégorie existe et appartient au compte.
      const existing = () =>
        new Category({
          id: cat,
          name: 'Courses',
          color: '#000000',
          type: CategoryType.EXPENSE,
          accountId: acc,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        });

      beforeEach(() => {
        mocks.categories.findById.mockResolvedValue(existing());
      });

      it('answers 400 beyond 255 characters and writes nothing', async () => {
        await http()
          .patch(`/${acc}/categories/${cat}`)
          .set(auth())
          .send({ name: long(256) })
          .expect(400);
        expect(mocks.categories.save).not.toHaveBeenCalled();
      });

      it('accepts 255 characters', async () => {
        await http()
          .patch(`/${acc}/categories/${cat}`)
          .set(auth())
          .send({ name: long(255) })
          .expect(200);
        expect(mocks.categories.save).toHaveBeenCalledTimes(1);
      });
    });

    it.each([
      ['post', '/accounts'],
      ['patch', `/accounts/${acc}`],
    ] as const)(
      '%s account with an empty or blank name answers 400',
      async (method, url) => {
        for (const name of ['', '   ']) {
          await http()[method](url).set(auth()).send({ name }).expect(400);
        }
        expect(mocks.accounts.save).not.toHaveBeenCalled();
      },
    );

    it('accepts a 255-character account name', async () => {
      await http()
        .post('/accounts')
        .set(auth())
        .send({ name: long(255) })
        .expect(201);
    });

    it('GET transactions answers 400 for a search above 200 characters', async () => {
      await http()
        .get(`/${acc}/transactions`)
        .query({ search: long(5000) })
        .set(auth())
        .expect(400);
      expect(mocks.transactions.findAllByAccount).not.toHaveBeenCalled();
    });

    it('GET transactions accepts a 200-character search', async () => {
      mocks.transactions.findAllByAccount.mockResolvedValue({
        data: [],
        total: 0,
      });
      await http()
        .get(`/${acc}/transactions`)
        .query({ search: long(200) })
        .set(auth())
        .expect(200);
    });

    describe('follow-up inputs (removed fields, blank text, paging)', () => {
      const rule = '00000000-0000-4000-8000-000000000115';
      const blank = '   ';
      const withPaymentMethod = {
        date: '2026-03-01',
        description: 'x',
        amount: '-100',
        paymentMethod: 'cash',
      };

      // Le moyen de paiement n'existe plus : même une ancienne valeur valide est refusée.
      it.each([
        ['post', `/${acc}/transactions`, withPaymentMethod],
        ['patch', `/${acc}/transactions/${tx}`, withPaymentMethod],
        [
          'post',
          `/${acc}/transactions/bulk`,
          { transactions: [withPaymentMethod] },
        ],
      ] as const)(
        '%s %s with a paymentMethod answers 400',
        async (method, url, body) => {
          const res = await http()[method](url).set(auth()).send(body);

          expect(res.status).toBe(400);
          expect(JSON.stringify(res.body)).toContain(
            'paymentMethod should not exist',
          );
        },
      );

      // Aucune détection ne produit d'anomalie « spike ».
      it('POST anomalies/ignore with the type spike answers 400', async () => {
        await http()
          .post(`/${acc}/reporting/anomalies/ignore`)
          .set(auth())
          .send({ transactionIds: [tx], type: 'spike' })
          .expect(400);
      });

      it.each(['duplicate', 'outlier'])(
        'POST anomalies/ignore accepts the type %s',
        async (type) => {
          const res = await http()
            .post(`/${acc}/reporting/anomalies/ignore`)
            .set(auth())
            .send({ transactionIds: [tx], type });
          expect(res.status).not.toBe(400);
        },
      );

      const blankCases: [string, 'post' | 'patch', string, object][] = [
        [
          'category name',
          'post',
          `/${acc}/categories`,
          { name: blank, color: '#000000', type: 'expense' },
        ],
        ['tag name', 'post', `/${acc}/tags`, { name: blank }],
        ['tag name', 'patch', `/${acc}/tags/${tag}`, { name: blank }],
        [
          'transaction description',
          'post',
          `/${acc}/transactions`,
          { date: '2026-03-01', description: blank, amount: '-100' },
        ],
        [
          'transaction description',
          'patch',
          `/${acc}/transactions/${tx}`,
          { description: blank },
        ],
        [
          'recurring description',
          'post',
          `/${acc}/recurring`,
          { description: blank, amount: '-100', dayOfMonth: 5 },
        ],
        [
          'recurring description',
          'patch',
          `/${acc}/recurring/${rec}`,
          { description: blank },
        ],
        [
          'transfer description',
          'post',
          `/${acc}/transactions/transfer`,
          {
            destinationAccountId: '00000000-0000-4000-8000-000000000102',
            date: '2026-03-01',
            description: blank,
            amount: '100',
          },
        ],
        [
          'smart rule pattern',
          'post',
          `/${acc}/smart-rules`,
          { pattern: blank, categoryId: null },
        ],
        [
          'smart rule pattern',
          'post',
          `/${acc}/smart-rules`,
          { pattern: 'x'.repeat(256), categoryId: null },
        ],
        [
          'smart rule pattern',
          'patch',
          `/${acc}/smart-rules/${rule}`,
          { pattern: blank },
        ],
        [
          'smart rule pattern',
          'patch',
          `/${acc}/smart-rules/${rule}`,
          { pattern: 'x'.repeat(256) },
        ],
      ];
      it.each(blankCases)(
        '%s blank or too long answers 400',
        async (_n, method, url, body) => {
          await http()[method](url).set(auth()).send(body).expect(400);
        },
      );

      it('POST transactions/predict answers 400 for a description above 255 characters', async () => {
        await http()
          .post(`/${acc}/transactions/predict-categories`)
          .set(auth())
          .send({ descriptions: ['x'.repeat(256)] })
          .expect(400);
      });

      it.each([
        ['limit', '0'],
        ['limit', '-1'],
        ['limit', '5001'],
        ['limit', 'abc'],
        ['limit', '1.5'],
        ['page', '0'],
        ['page', '-2'],
        ['page', 'abc'],
        ['page', '1.5'],
      ])('GET transactions answers 400 for %s=%s', async (field, value) => {
        await http()
          .get(`/${acc}/transactions`)
          .query({ [field]: value })
          .set(auth())
          .expect(400);
        expect(mocks.transactions.findAllByAccount).not.toHaveBeenCalled();
      });

      it('GET transactions accepts page=2&limit=5000 and forwards integers', async () => {
        mocks.transactions.findAllByAccount.mockResolvedValue({
          data: [],
          total: 0,
        });
        await http()
          .get(`/${acc}/transactions`)
          .query({ page: '2', limit: '5000' })
          .set(auth())
          .expect(200);
        const [[, options]] = mocks.transactions.findAllByAccount.mock
          .calls as [[string, { page: number; limit: number }]];
        expect(options.page).toBe(2);
        expect(options.limit).toBe(5000);
      });
    });
  });
});
