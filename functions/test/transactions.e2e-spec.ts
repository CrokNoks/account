import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks } from './e2e-app';
import { Transaction } from '../src/transactions/domain/transaction.entity';

const tx = (id: string, overrides: Partial<Transaction> = {}) =>
  Transaction.create({
    id,
    accountId: 'acc-1',
    categoryId: 'cat-1',
    date: new Date('2026-03-01T00:00:00.000Z'),
    description: `tx ${id}`,
    amount: BigInt(-4250),
    reconciled: false,
    pending: false,
    ...overrides,
  });

describe('Transactions routes (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mocks.transactions.save.mockResolvedValue(undefined);
    mocks.transactions.delete.mockResolvedValue(undefined);
    mocks.transactions.findById.mockResolvedValue(tx('t1'));
    mocks.transactions.findAllByAccountUnpaginated.mockResolvedValue([
      tx('t1'),
      tx('t2'),
    ]);
    mocks.smartRules.findAllByAccount.mockResolvedValue([]);
  });

  describe('POST /:accountId/transactions', () => {
    const body = {
      date: '2026-03-01',
      description: 'CB CARREFOUR',
      amount: '-4250',
    };

    it('creates the transaction on the account of the URL and returns amounts as strings', async () => {
      const res = await http()
        .post('/acc-1/transactions')
        .set(auth())
        .send(body)
        .expect(201);

      expect(res.body).toMatchObject({
        accountId: 'acc-1',
        description: 'CB CARREFOUR',
        amount: '-4250',
        reconciled: false,
        pending: false,
        tagIds: [],
      });
      expect(mocks.transactions.save).toHaveBeenCalledTimes(1);
    });

    describe('body validation', () => {
      it.each([
        ['an unknown field', { ...body, foo: 'bar' }],
        ['an accountId in the body', { ...body, accountId: 'acc-pirate' }],
        ['non string tag ids', { ...body, tagIds: [1, 2] }],
        ['an amount sent as number', { ...body, amount: -4250 }],
        ['a non numeric amount', { ...body, amount: '12 €' }],
        ['a missing date', { ...body, date: undefined }],
        ['an invalid date', { ...body, date: 'hier' }],
        ['a missing description', { ...body, description: undefined }],
      ])('answers 400 without saving for %s', async (_, payload) => {
        await http()
          .post('/acc-1/transactions')
          .set(auth())
          .send(payload)
          .expect(400);
        expect(mocks.transactions.save).not.toHaveBeenCalled();
      });

      it('rounds a decimal amount to the nearest cent', async () => {
        const res = await http()
          .post('/acc-1/transactions')
          .set(auth())
          .send({ ...body, amount: '12.6' })
          .expect(201);

        expect((res.body as Record<string, unknown>).amount).toBe('13');
      });

      it('accepts the payload sent by the front (null category, no period)', () =>
        http()
          .post('/acc-1/transactions')
          .set(auth())
          .send({ ...body, categoryId: null, pending: false, tagIds: [] })
          .expect(201));

      it('answers 400 without saving for a blank description (entity rule)', async () => {
        await http()
          .post('/acc-1/transactions')
          .set(auth())
          .send({ ...body, description: '   ' })
          .expect(400, {
            statusCode: 400,
            message: 'Description is required',
            error: 'Bad Request',
          });
        expect(mocks.transactions.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('GET /:accountId/transactions', () => {
    it('passes filters and pagination to the repository', async () => {
      mocks.transactions.findAllByAccount.mockResolvedValue({
        data: [tx('t1')],
        meta: { total: 1, page: 2, limit: 10, totalPages: 1 },
      });

      const res = await http()
        .get('/acc-1/transactions')
        .query({
          search: 'carrefour',
          minAmount: '-5000',
          page: '2',
          limit: '10',
        })
        .set(auth())
        .expect(200);

      expect((res.body as Record<string, unknown>).data).toHaveLength(1);
      expect((res.body as Record<string, unknown>).meta).toEqual({
        total: 1,
        page: 2,
        limit: 10,
        totalPages: 1,
      });
      expect(mocks.transactions.findAllByAccount).toHaveBeenCalledWith(
        'acc-1',
        expect.objectContaining({
          search: 'carrefour',
          minAmount: BigInt(-5000),
          page: 2,
          limit: 10,
        }),
      );
    });

    it('answers 404 for an unknown period', async () => {
      mocks.periods.findById.mockResolvedValue(null);

      await http()
        .get('/acc-1/transactions')
        .query({ periodId: 'nope' })
        .set(auth())
        .expect(404);
    });
  });

  describe('POST /:accountId/transactions/transfer', () => {
    it('creates both sides of the transfer', async () => {
      const res = await http()
        .post('/acc-1/transactions/transfer')
        .set(auth())
        .send({
          destinationAccountId: 'acc-2',
          date: '2026-03-01',
          description: 'Épargne',
          amount: '15000',
        })
        .expect(201);

      expect(
        (res.body as { accountId: string; amount: string }[]).map((t) => [
          t.accountId,
          t.amount,
        ]),
      ).toEqual([
        ['acc-1', '-15000'],
        ['acc-2', '15000'],
      ]);
    });

    it('answers 400 for a transfer to the same account', () =>
      http()
        .post('/acc-1/transactions/transfer')
        .set(auth())
        .send({
          destinationAccountId: 'acc-1',
          date: '2026-03-01',
          description: 'x',
          amount: '100',
        })
        .expect(400));
  });

  describe('POST /:accountId/transactions/bulk', () => {
    it('creates every line', async () => {
      const res = await http()
        .post('/acc-1/transactions/bulk')
        .set(auth())
        .send({
          transactions: [
            { date: '2026-03-01', description: 'A', amount: '-100' },
            { date: '2026-03-02', description: 'B', amount: '-200' },
          ],
        })
        .expect(201);

      expect(res.body).toHaveLength(2);
      expect(mocks.transactions.save).toHaveBeenCalledTimes(2);
    });

    it('validates each line', () =>
      http()
        .post('/acc-1/transactions/bulk')
        .set(auth())
        .send({ transactions: [{ date: 'x', description: 'A', amount: '1' }] })
        .expect(400));
  });

  describe('PATCH /:accountId/transactions/:id', () => {
    it('updates the transaction and clears pending when reconciling', async () => {
      mocks.transactions.findById.mockResolvedValue(
        tx('t1', { pending: true }),
      );

      const res = await http()
        .patch('/acc-1/transactions/t1')
        .set(auth())
        .send({ reconciled: true })
        .expect(200);

      expect(res.body).toMatchObject({ reconciled: true, pending: false });
    });

    it('answers 404 for an unknown transaction', async () => {
      mocks.transactions.findById.mockResolvedValue(null);

      await http()
        .patch('/acc-1/transactions/nope')
        .set(auth())
        .send({ notes: 'x' })
        .expect(404);
    });

    it('refuses unknown fields and an accountId in the body, without saving', async () => {
      mocks.transactions.findById.mockResolvedValue(tx('t1'));

      await http()
        .patch('/acc-1/transactions/t1')
        .set(auth())
        .send({ accountId: 'acc-pirate' })
        .expect(400);
      await http()
        .patch('/acc-1/transactions/t1')
        .set(auth())
        .send({ foo: 'bar' })
        .expect(400);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('refuses an invalid amount or date', async () => {
      mocks.transactions.findById.mockResolvedValue(tx('t1'));

      await http()
        .patch('/acc-1/transactions/t1')
        .set(auth())
        .send({ amount: 'abc' })
        .expect(400);
      await http()
        .patch('/acc-1/transactions/t1')
        .set(auth())
        .send({ date: 'hier' })
        .expect(400);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('only changes the provided fields', async () => {
      const existing = tx('t1');
      mocks.transactions.findById.mockResolvedValue(existing);

      await http()
        .patch('/acc-1/transactions/t1')
        .set(auth())
        .send({ notes: 'x' })
        .expect(200);

      const [[saved]] = mocks.transactions.save.mock.calls as [Transaction][];
      expect(saved.notes).toBe('x');
      expect(saved.description).toBe(existing.description);
      expect(saved.amount).toBe(existing.amount);
      expect(saved.date).toEqual(existing.date);
      expect(saved.accountId).toBe(existing.accountId);
    });

    // Comportement actuel documenté : rien ne vérifie que la transaction
    // appartient au compte de l'URL (seule la RLS protège).
    it('updates a transaction of another account reached through any accountId', async () => {
      mocks.transactions.findById.mockResolvedValue(
        tx('t9', { accountId: 'acc-other' }),
      );

      const res = await http()
        .patch('/acc-1/transactions/t9')
        .set(auth())
        .send({ notes: 'x' })
        .expect(200);

      expect((res.body as Record<string, unknown>).accountId).toBe('acc-other');
    });
  });

  describe('bulk routes', () => {
    it('PATCH /bulk updates the requested transactions of the account', async () => {
      await http()
        .patch('/acc-1/transactions/bulk')
        .set(auth())
        .send({ ids: ['t1'], data: { categoryId: 'cat-2', pending: true } })
        .expect(200);

      const [[saved]] = mocks.transactions.save.mock.calls as [Transaction][];
      expect(mocks.transactions.save).toHaveBeenCalledTimes(1);
      expect(saved.id).toBe('t1');
      expect(saved.categoryId).toBe('cat-2');
      expect(saved.pending).toBe(true);
    });

    it.each([
      ['an unknown field in data', { foo: 'bar' }],
      ['a non boolean reconciled', { reconciled: 'yes' }],
      ['a non boolean pending', { pending: 1 }],
      ['non string tag ids', { tagIds: [1] }],
      ['a non string categoryId', { categoryId: 42 }],
    ])('PATCH /bulk answers 400 without saving for %s', async (_, data) => {
      await http()
        .patch('/acc-1/transactions/bulk')
        .set(auth())
        .send({ ids: ['t1'], data })
        .expect(400);

      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('PATCH /bulk accepts a null categoryId', async () => {
      await http()
        .patch('/acc-1/transactions/bulk')
        .set(auth())
        .send({ ids: ['t1'], data: { categoryId: null } })
        .expect(200);

      const [[saved]] = mocks.transactions.save.mock.calls as [Transaction][];
      expect(saved.categoryId).toBeNull();
    });

    it('DELETE /bulk deletes the requested ids of the account and not the id "bulk"', async () => {
      await http()
        .delete('/acc-1/transactions/bulk')
        .set(auth())
        .send({ ids: ['t1', 't2', 't-other-account'] })
        .expect(200);

      expect(mocks.transactions.delete.mock.calls).toEqual([['t1'], ['t2']]);
    });

    it('DELETE /bulk answers 400 without deleting when ids is missing', async () => {
      await http()
        .delete('/acc-1/transactions/bulk')
        .set(auth())
        .send({})
        .expect(400);

      expect(mocks.transactions.delete).not.toHaveBeenCalled();
    });
  });

  it('DELETE /:accountId/transactions/:id answers 204', async () => {
    await http().delete('/acc-1/transactions/t1').set(auth()).expect(204);

    expect(mocks.transactions.delete).toHaveBeenCalledWith('t1');
  });
});
