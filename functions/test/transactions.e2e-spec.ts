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

    // Comportement actuel : le body est typé Omit<CreateTransactionDto, ...>,
    // ValidationPipe ne voit qu'un Object et ne valide rien.
    describe('body is not validated', () => {
      it.each([
        ['an unknown field', { ...body, foo: 'bar' }],
        ['non string tag ids', { ...body, tagIds: [1, 2] }],
        ['an amount sent as number', { ...body, amount: -4250 }],
      ])('accepts %s', async (_, payload) => {
        await http()
          .post('/acc-1/transactions')
          .set(auth())
          .send(payload)
          .expect(201);
      });

      it('rounds a decimal amount to the nearest cent', async () => {
        const res = await http()
          .post('/acc-1/transactions')
          .set(auth())
          .send({ ...body, amount: '12.6' })
          .expect(201);

        expect((res.body as Record<string, unknown>).amount).toBe('13');
      });

      it.each([
        ['a missing date', { ...body, date: undefined }],
        ['an invalid date', { ...body, date: 'hier' }],
      ])(
        'saves the transaction with %s, then answers 500',
        async (_, payload) => {
          await http()
            .post('/acc-1/transactions')
            .set(auth())
            .send(payload)
            .expect(500);

          expect(mocks.transactions.save).toHaveBeenCalledTimes(1);
          const [[saved]] = mocks.transactions.save.mock.calls as [
            Transaction,
          ][];
          expect(Number.isNaN(saved.date.getTime())).toBe(true);
        },
      );

      it.each([
        ['a non numeric amount', { ...body, amount: '12 €' }],
        ['a missing description', { ...body, description: undefined }],
        ['a blank description', { ...body, description: '   ' }],
      ])('answers 500 without saving for %s', async (_, payload) => {
        await http()
          .post('/acc-1/transactions')
          .set(auth())
          .send(payload)
          .expect(500);
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

    it('answers 500 for a transfer to the same account', () =>
      http()
        .post('/acc-1/transactions/transfer')
        .set(auth())
        .send({
          destinationAccountId: 'acc-1',
          date: '2026-03-01',
          description: 'x',
          amount: '100',
        })
        .expect(500));
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

    it('answers 500 for an unknown transaction', async () => {
      mocks.transactions.findById.mockResolvedValue(null);

      await http()
        .patch('/acc-1/transactions/nope')
        .set(auth())
        .send({ notes: 'x' })
        .expect(500);
    });

    // Comportement actuel : le body (type intersection) n'est pas validé par
    // ValidationPipe et il est recopié dans la transaction.
    it('does not validate the body: unknown fields pass and accountId can be overwritten', async () => {
      const res = await http()
        .patch('/acc-1/transactions/t1')
        .set(auth())
        .send({ accountId: 'acc-pirate', foo: 'bar' })
        .expect(200);

      expect((res.body as Record<string, unknown>).accountId).toBe(
        'acc-pirate',
      );
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

  describe('bulk routes declared after :id', () => {
    // Comportement actuel documenté (docs/transactions.md) : PATCH :id et
    // DELETE :id sont déclarées avant PATCH bulk et DELETE bulk, qui sont donc
    // inatteignables.
    it('PATCH /bulk is handled as PATCH /:id with id "bulk"', async () => {
      mocks.transactions.findById.mockResolvedValue(null);

      await http()
        .patch('/acc-1/transactions/bulk')
        .set(auth())
        .send({ ids: ['t1'], data: { reconciled: true } })
        .expect(500);

      expect(mocks.transactions.findById).toHaveBeenCalledWith('bulk');
      expect(
        mocks.transactions.findAllByAccountUnpaginated,
      ).not.toHaveBeenCalled();
    });

    it('DELETE /bulk deletes the id "bulk" and none of the requested ids', async () => {
      await http()
        .delete('/acc-1/transactions/bulk')
        .set(auth())
        .send({ ids: ['t1', 't2'] })
        .expect(204);

      expect(mocks.transactions.delete.mock.calls).toEqual([['bulk']]);
    });
  });

  it('DELETE /:accountId/transactions/:id answers 204', async () => {
    await http().delete('/acc-1/transactions/t1').set(auth()).expect(204);

    expect(mocks.transactions.delete).toHaveBeenCalledWith('t1');
  });
});
