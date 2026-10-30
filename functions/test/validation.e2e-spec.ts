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

  // Comportement actuel : ces routes typent leur body avec Omit<>, Partial<>
  // ou un type littéral ; ValidationPipe ne voit qu'un Object et ne valide rien.
  describe('routes whose body is not validated', () => {
    it('POST /:accountId/categories accepts unknown fields', () =>
      http()
        .post('/acc-1/categories')
        .set(auth())
        .send({ name: 'Courses', color: '#000000', type: 'expense', foo: 1 })
        .expect(201));

    it('POST /:accountId/categories answers 500 (not 400) for an invalid color and type', () =>
      http()
        .post('/acc-1/categories')
        .set(auth())
        .send({ name: 'Courses', color: 'red', type: 'weird' })
        .expect(500));

    it('POST /:accountId/periods accepts unknown fields', () =>
      http()
        .post('/acc-1/periods')
        .set(auth())
        .send({
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          budgets: [],
          foo: 1,
        })
        .expect(201));

    it('POST /:accountId/periods answers 500 (not 400) without budgets', () =>
      http()
        .post('/acc-1/periods')
        .set(auth())
        .send({ startDate: '2026-03-01', endDate: '2026-03-31' })
        .expect(500));

    it('PATCH /:accountId/recurring/:id lets the body move the recurring transaction to another account', async () => {
      const res = await http()
        .patch('/acc-1/recurring/r1')
        .set(auth())
        .send({ amount: '-90000', accountId: 'acc-other' })
        .expect(200);

      expect((res.body as { accountId: string }).accountId).toBe('acc-other');
    });

    it('PATCH /:accountId/recurring/:id without amount saves an undefined amount, then answers 500', async () => {
      await http()
        .patch('/acc-1/recurring/r1')
        .set(auth())
        .send({ description: 'Loyer appartement' })
        .expect(500);

      const [[saved]] = mocks.recurring.save.mock.calls as [
        RecurringTransaction,
      ][];
      expect(saved.description).toBe('Loyer appartement');
      expect(saved.amount).toBeUndefined();
    });
  });
});
