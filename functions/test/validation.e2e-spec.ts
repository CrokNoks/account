import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks } from './e2e-app';
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
    mocks.budgets.saveBulk.mockResolvedValue(undefined);
    mocks.recurring.findById.mockResolvedValue(
      RecurringTransaction.create({
        id: 'r1',
        accountId: 'acc-1',
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
      ['patch', '/accounts/acc-1'],
      ['post', '/accounts/acc-1/shares'],
      ['patch', '/acc-1/categories/c1'],
      ['patch', '/acc-1/periods/p1'],
      ['put', '/acc-1/periods/p1/budgets'],
      ['post', '/acc-1/recurring'],
      ['post', '/acc-1/transactions'],
      ['patch', '/acc-1/transactions/t1'],
      ['post', '/acc-1/periods'],
      ['post', '/acc-1/categories'],
      ['post', '/acc-1/reporting/scan-receipt'],
      ['patch', '/acc-1/recurring/r1'],
      ['post', '/acc-1/tags'],
      ['patch', '/acc-1/tags/t1'],
      ['post', '/acc-1/smart-rules'],
      ['patch', '/acc-1/smart-rules/s1'],
      ['post', '/acc-1/savings-goals'],
      ['patch', '/acc-1/savings-goals/g1'],
      ['patch', '/preferences'],
      ['post', '/acc-1/transactions/transfer'],
      ['post', '/acc-1/transactions/bulk'],
      ['post', '/acc-1/reporting/anomalies/ignore'],
    ] as const)('%s %s', async (method, url) => {
      const res = await http()[method](url).set(auth()).send({ foo: 'bar' });

      expect(res.status).toBe(400);
      expect((res.body as { message: string[] }).message).toContain(
        'property foo should not exist',
      );
    });

    it('rejects an invalid share permission', () =>
      http()
        .post('/accounts/acc-1/shares')
        .set(auth())
        .send({ email: 'guest@example.com', permission: 'admin' })
        .expect(400));
  });

  describe('bodies that used to be typed Omit<>/literal are now validated', () => {
    it('POST /:accountId/categories answers 400 for an invalid color and type', () =>
      http()
        .post('/acc-1/categories')
        .set(auth())
        .send({ name: 'Courses', color: 'red', type: 'weird' })
        .expect(400));

    it('POST /:accountId/categories refuses an accountId in the body', () =>
      http()
        .post('/acc-1/categories')
        .set(auth())
        .send({
          name: 'Courses',
          color: '#000000',
          type: 'expense',
          accountId: 'acc-other',
        })
        .expect(400));

    it('POST /:accountId/categories accepts the front payload', () =>
      http()
        .post('/acc-1/categories')
        .set(auth())
        .send({ name: 'Courses', color: '#000000', type: 'expense' })
        .expect(201));

    it('POST /:accountId/periods answers 400 without budgets', () =>
      http()
        .post('/acc-1/periods')
        .set(auth())
        .send({ startDate: '2026-03-01', endDate: '2026-03-31' })
        .expect(400));

    it('POST /:accountId/periods refuses an accountId in the body', () =>
      http()
        .post('/acc-1/periods')
        .set(auth())
        .send({
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          budgets: [],
          accountId: 'acc-other',
        })
        .expect(400));

    it('POST /:accountId/periods accepts the front payload', () => {
      mocks.recurring.findAllByAccount.mockResolvedValue([]);
      mocks.categories.findById.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000019',
        accountId: 'acc-1',
      });
      return http()
        .post('/acc-1/periods')
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

  describe('PATCH /:accountId/recurring/:id', () => {
    it('answers 404 for an unknown recurring transaction', async () => {
      mocks.recurring.findById.mockResolvedValue(null);

      await http()
        .patch('/acc-1/recurring/nope')
        .set(auth())
        .send({ description: 'x' })
        .expect(404);
      expect(mocks.recurring.save).not.toHaveBeenCalled();
    });

    it('keeps the existing amount when the body has no amount', async () => {
      const res = await http()
        .patch('/acc-1/recurring/r1')
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
        .patch('/acc-1/recurring/r1')
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
        .patch('/acc-1/recurring/r1')
        .set(auth())
        .send({ amount: '-90000', accountId: 'acc-other' })
        .expect(400);

      expect(mocks.recurring.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid amount and day of month', async () => {
      await http()
        .patch('/acc-1/recurring/r1')
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
      ['post', '/acc-1/transactions', { ...tx, savingsGoalId: bad }],
      ['post', '/acc-1/transactions', { ...tx, categoryId: bad }],
      ['post', '/acc-1/transactions', { ...tx, periodId: bad }],
      ['post', '/acc-1/transactions', { ...tx, tagIds: [bad] }],
      ['patch', '/acc-1/transactions/t1', { savingsGoalId: bad }],
      [
        'post',
        '/acc-1/transactions/bulk',
        { transactions: [{ ...tx, categoryId: bad }] },
      ],
      ['patch', '/acc-1/transactions/bulk', { ids: [bad], data: {} }],
      [
        'patch',
        '/acc-1/transactions/bulk',
        { ids: [], data: { categoryId: bad } },
      ],
      ['delete', '/acc-1/transactions/bulk', { ids: [bad] }],
      [
        'post',
        '/acc-1/transactions/transfer',
        {
          destinationAccountId: bad,
          date: '2026-03-01',
          description: 'x',
          amount: '100',
        },
      ],
      [
        'post',
        '/acc-1/recurring',
        { categoryId: bad, description: 'x', amount: '-1', dayOfMonth: 5 },
      ],
      ['post', '/acc-1/smart-rules', { pattern: 'x', categoryId: bad }],
      ['post', '/acc-1/smart-rules', { pattern: 'x', tagIds: [bad] }],
      [
        'post',
        '/acc-1/periods',
        {
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          budgets: [{ categoryId: bad, amountAllocated: '1' }],
        },
      ],
      [
        'post',
        '/acc-1/reporting/anomalies/ignore',
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
        .get('/acc-1/transactions')
        .query({ categoryId: bad })
        .set(auth())
        .expect(400);
      await http()
        .get('/acc-1/transactions')
        .query({ periodId: bad })
        .set(auth())
        .expect(400);
    });
  });
});
