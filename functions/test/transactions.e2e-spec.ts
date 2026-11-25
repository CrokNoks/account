import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks } from './e2e-app';
import { Transaction } from '../src/transactions/domain/transaction.entity';
import { Account } from '../src/accounts/domain/account.entity';
import { Period } from '../src/periods/domain/period.entity';
import { ConflictError, ForbiddenError } from '../src/shared/domain/errors';
import {
  addDaysDateOnly,
  parseDateOnly,
  todayDateOnly,
  toDateOnly,
} from '../src/shared/domain/date-only';

const tx = (id: string, overrides: Partial<Transaction> = {}) =>
  Transaction.create({
    id,
    accountId: '00000000-0000-4000-8000-000000000101',
    categoryId: '00000000-0000-4000-8000-000000000012',
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
    mocks.transactions.delete.mockResolvedValue(undefined);
    mocks.transactions.findById.mockResolvedValue(
      tx('00000000-0000-4000-8000-000000000016'),
    );
    mocks.transactions.findAllByAccountUnpaginated.mockResolvedValue([
      tx('00000000-0000-4000-8000-000000000016'),
      tx('00000000-0000-4000-8000-000000000017'),
    ]);
    mocks.smartRules.findAllByAccount.mockResolvedValue([]);
    mocks.categories.findById.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000013',
      accountId: '00000000-0000-4000-8000-000000000101',
    });
    mocks.accounts.findById.mockResolvedValue(
      new Account({
        id: '00000000-0000-4000-8000-000000000014',
        name: 'Épargne',
        ownerId: '00000000-0000-4000-8000-000000000106',
      }),
    );
  });

  describe('POST /:accountId/transactions', () => {
    const body = {
      date: '2026-03-01',
      description: 'CB CARREFOUR',
      amount: '-4250',
    };

    it('creates the transaction on the account of the URL and returns amounts as strings', async () => {
      const res = await http()
        .post('/00000000-0000-4000-8000-000000000101/transactions')
        .set(auth())
        .send(body)
        .expect(201);

      expect(res.body).toMatchObject({
        accountId: '00000000-0000-4000-8000-000000000101',
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
        [
          'an accountId in the body',
          { ...body, accountId: '00000000-0000-4000-8000-000000000103' },
        ],
        ['non string tag ids', { ...body, tagIds: [1, 2] }],
        ['an amount sent as number', { ...body, amount: -4250 }],
        ['a non numeric amount', { ...body, amount: '12 €' }],
        ['a missing date', { ...body, date: undefined }],
        ['an invalid date', { ...body, date: 'hier' }],
        ['a missing description', { ...body, description: undefined }],
      ])('answers 400 without saving for %s', async (_, payload) => {
        await http()
          .post('/00000000-0000-4000-8000-000000000101/transactions')
          .set(auth())
          .send(payload)
          .expect(400);
        expect(mocks.transactions.save).not.toHaveBeenCalled();
      });

      it.each([
        ['a decimal amount', '12.5'],
        ['an exponent notation', '1e3'],
        ['an explicit plus sign', '+5'],
        ['an amount above 2^53 - 1', '9007199254740992'],
        ['an amount below -(2^53 - 1)', '-9007199254740992'],
        ['the largest signed 64-bit amount', '9223372036854775807'],
        ['a huge amount', '99999999999999999999999'],
      ])('answers 400 without saving for %s', async (_, amount) => {
        await http()
          .post('/00000000-0000-4000-8000-000000000101/transactions')
          .set(auth())
          .send({ ...body, amount })
          .expect(400);
        expect(mocks.transactions.save).not.toHaveBeenCalled();
      });

      it.each([
        ['the largest accepted amount (2^53 - 1)', '9007199254740991'],
        ['the smallest accepted amount', '-9007199254740991'],
        ['a negative zero', '-0'],
      ])(
        'keeps %s exactly, without going through a float',
        async (_, amount) => {
          const res = await http()
            .post('/00000000-0000-4000-8000-000000000101/transactions')
            .set(auth())
            .send({ ...body, amount })
            .expect(201);

          expect((res.body as Record<string, unknown>).amount).toBe(
            amount === '-0' ? '0' : amount,
          );
        },
      );

      it('accepts the payload sent by the front (null category, no period)', () =>
        http()
          .post('/00000000-0000-4000-8000-000000000101/transactions')
          .set(auth())
          .send({ ...body, categoryId: null, pending: false, tagIds: [] })
          .expect(201));

      it('answers 400 without saving for a blank description (entity rule)', async () => {
        await http()
          .post('/00000000-0000-4000-8000-000000000101/transactions')
          .set(auth())
          .send({ ...body, description: '   ' })
          .expect(400, {
            statusCode: 400,
            message: ['Description is required'],
            error: 'Bad Request',
          });
        expect(mocks.transactions.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('GET /:accountId/transactions', () => {
    it('passes filters and pagination to the repository', async () => {
      mocks.transactions.findAllByAccount.mockResolvedValue({
        data: [tx('00000000-0000-4000-8000-000000000016')],
        meta: { total: 1, page: 2, limit: 10, totalPages: 1 },
      });

      const res = await http()
        .get('/00000000-0000-4000-8000-000000000101/transactions')
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
        '00000000-0000-4000-8000-000000000101',
        expect.objectContaining({
          search: 'carrefour',
          minAmount: BigInt(-5000),
          page: 2,
          limit: 10,
        }),
      );
    });

    it('passes the ids filter to the repository', async () => {
      mocks.transactions.findAllByAccount.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 1000, totalPages: 0 },
      });
      const ids = [
        '00000000-0000-4000-8000-000000000016',
        '00000000-0000-4000-8000-000000000017',
      ];

      await http()
        .get('/00000000-0000-4000-8000-000000000101/transactions')
        .query({ ids: ids.join(',') })
        .set(auth())
        .expect(200);

      expect(mocks.transactions.findAllByAccount).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000101',
        expect.objectContaining({ ids }),
      );
    });

    it('answers 400 without querying for an invalid uuid in ids', async () => {
      await http()
        .get('/00000000-0000-4000-8000-000000000101/transactions')
        .query({ ids: '00000000-0000-4000-8000-000000000016,pas-un-uuid' })
        .set(auth())
        .expect(400);

      expect(mocks.transactions.findAllByAccount).not.toHaveBeenCalled();
    });

    it.each([
      ['reconciled=false&pending=false', { reconciled: false, pending: false }],
      ['reconciled=false&pending=true', { reconciled: false, pending: true }],
      ['pending=true', { pending: true }],
    ])('passes %s to the repository as booleans', async (_n, flags) => {
      mocks.transactions.findAllByAccount.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 1000, totalPages: 0 },
      });

      await http()
        .get('/00000000-0000-4000-8000-000000000101/transactions')
        .query(flags)
        .set(auth())
        .expect(200);

      expect(mocks.transactions.findAllByAccount).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000101',
        expect.objectContaining(flags),
      );
    });

    it('answers 400 without querying for pending=maybe', async () => {
      await http()
        .get('/00000000-0000-4000-8000-000000000101/transactions')
        .query({ pending: 'maybe' })
        .set(auth())
        .expect(400);

      expect(mocks.transactions.findAllByAccount).not.toHaveBeenCalled();
    });

    it('passes the window of the period together with startDate and endDate, which narrow it', async () => {
      mocks.transactions.findAllByAccount.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 1000, totalPages: 0 },
      });
      mocks.periods.findById.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000021',
        accountId: '00000000-0000-4000-8000-000000000101',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-30'),
        isActive: true,
      });

      await http()
        .get('/00000000-0000-4000-8000-000000000101/transactions')
        .query({
          periodId: '00000000-0000-4000-8000-000000000021',
          startDate: '2026-11-10',
          endDate: '2026-11-20',
        })
        .set(auth())
        .expect(200);

      expect(mocks.transactions.findAllByAccount).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000101',
        expect.objectContaining({
          startDate: new Date('2026-11-10'),
          endDate: new Date('2026-11-20'),
          periodWindow: {
            startDate: new Date('2026-11-01'),
            endDate: new Date('2026-11-30'),
            isActive: true,
          },
        }),
      );
    });

    it('answers 404 for an unknown period', async () => {
      mocks.periods.findById.mockResolvedValue(null);

      await http()
        .get('/00000000-0000-4000-8000-000000000101/transactions')
        .query({ periodId: '00000000-0000-4000-8000-000000000021' })
        .set(auth())
        .expect(404);
    });
  });

  describe('POST /:accountId/transactions/transfer', () => {
    it('creates both sides of the transfer', async () => {
      const res = await http()
        .post('/00000000-0000-4000-8000-000000000101/transactions/transfer')
        .set(auth())
        .send({
          destinationAccountId: '00000000-0000-4000-8000-000000000014',
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
        ['00000000-0000-4000-8000-000000000101', '-15000'],
        ['00000000-0000-4000-8000-000000000014', '15000'],
      ]);
    });

    it('answers 400 without saving for a non integer amount', async () => {
      await http()
        .post('/00000000-0000-4000-8000-000000000101/transactions/transfer')
        .set(auth())
        .send({
          destinationAccountId: '00000000-0000-4000-8000-000000000014',
          date: '2026-03-01',
          description: 'Épargne',
          amount: '150.5',
        })
        .expect(400);
      expect(mocks.transactions.saveTransfer).not.toHaveBeenCalled();
    });

    it('answers 400 for a transfer to the same account', () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/transactions/transfer')
        .set(auth())
        .send({
          destinationAccountId: '00000000-0000-4000-8000-000000000101',
          date: '2026-03-01',
          description: 'x',
          amount: '100',
        })
        .expect(400));
  });

  describe('POST /:accountId/transactions/bulk', () => {
    it('creates every line', async () => {
      const res = await http()
        .post('/00000000-0000-4000-8000-000000000101/transactions/bulk')
        .set(auth())
        .send({
          transactions: [
            { date: '2026-03-01', description: 'A', amount: '-100' },
            { date: '2026-03-02', description: 'B', amount: '-200' },
          ],
        })
        .expect(201);

      expect(res.body).toHaveLength(2);
      expect(mocks.transactions.saveMany).toHaveBeenCalledTimes(1);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('answers 400 without saving when a line has a non integer amount', async () => {
      await http()
        .post('/00000000-0000-4000-8000-000000000101/transactions/bulk')
        .set(auth())
        .send({
          transactions: [
            { date: '2026-03-01', description: 'A', amount: '-100' },
            { date: '2026-03-02', description: 'B', amount: '-20.5' },
          ],
        })
        .expect(400);
      expect(mocks.transactions.saveMany).not.toHaveBeenCalled();
    });

    it('validates each line', () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/transactions/bulk')
        .set(auth())
        .send({ transactions: [{ date: 'x', description: 'A', amount: '1' }] })
        .expect(400));
  });

  describe('long bank labels (limit 1000 characters)', () => {
    const acc = '00000000-0000-4000-8000-000000000101';
    const cat = '00000000-0000-4000-8000-000000000012';
    // A 334-character label like the multi-line Crédit Agricole ones.
    const label = (n: number) =>
      (
        'Prélèvement ORANGE abonnement mobile ' + 'REF0123456789 '.repeat(80)
      ).slice(0, n);

    it('bulk accepts a 334-character description', async () => {
      await http()
        .post(`/${acc}/transactions/bulk`)
        .set(auth())
        .send({
          transactions: [
            { date: '2026-03-01', description: label(334), amount: '-100' },
          ],
        })
        .expect(201);
      expect(mocks.transactions.saveMany).toHaveBeenCalledTimes(1);
    });

    it('bulk refuses a description above 1000 characters and saves nothing', async () => {
      await http()
        .post(`/${acc}/transactions/bulk`)
        .set(auth())
        .send({
          transactions: [
            { date: '2026-03-01', description: label(1001), amount: '-100' },
          ],
        })
        .expect(400);
      expect(mocks.transactions.saveMany).not.toHaveBeenCalled();
    });

    it('create and update accept 1000 characters and refuse 1001', async () => {
      mocks.transactions.findById.mockResolvedValue(
        tx('00000000-0000-4000-8000-000000000111'),
      );
      const url = `/${acc}/transactions`;
      const one = (description: string) => ({
        date: '2026-03-01',
        description,
        amount: '-100',
      });
      await http()
        .post(url)
        .set(auth())
        .send(one(label(1000)))
        .expect(201);
      await http()
        .post(url)
        .set(auth())
        .send(one(label(1001)))
        .expect(400);
      const upd = `${url}/00000000-0000-4000-8000-000000000111`;
      await http()
        .patch(upd)
        .set(auth())
        .send({ description: label(1000) })
        .expect(200);
      await http()
        .patch(upd)
        .set(auth())
        .send({ description: label(1001) })
        .expect(400);
    });

    it('predict-categories predicts the category of a 334-character label and refuses above 1000', async () => {
      mocks.smartRules.findAllByAccount.mockResolvedValue([]);
      mocks.transactions.findAllByAccountUnpaginated.mockResolvedValue([
        tx('00000000-0000-4000-8000-000000000016', {
          description: 'Prélèvement ORANGE abonnement mobile',
          categoryId: cat,
        }),
      ]);
      const predict = (descriptions: string[]) =>
        http()
          .post(`/${acc}/transactions/predict-categories`)
          .set(auth())
          .send({ descriptions });

      const ok = await predict([label(334)]).expect(200);
      expect((ok.body as { predictions: unknown }).predictions).toEqual([
        { categoryId: cat },
      ]);
      await predict([label(1001)]).expect(400);
    });
  });

  describe('PATCH /:accountId/transactions/:id', () => {
    it('updates the transaction and clears pending when reconciling', async () => {
      mocks.transactions.findById.mockResolvedValue(
        tx('00000000-0000-4000-8000-000000000016', { pending: true }),
      );

      const res = await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        )
        .set(auth())
        .send({ reconciled: true })
        .expect(200);

      expect(res.body).toMatchObject({ reconciled: true, pending: false });
    });

    it('answers 404 for an unknown transaction', async () => {
      mocks.transactions.findById.mockResolvedValue(null);

      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000199',
        )
        .set(auth())
        .send({ notes: 'x' })
        .expect(404);
    });

    it('refuses unknown fields and an accountId in the body, without saving', async () => {
      mocks.transactions.findById.mockResolvedValue(
        tx('00000000-0000-4000-8000-000000000016'),
      );

      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        )
        .set(auth())
        .send({ accountId: '00000000-0000-4000-8000-000000000103' })
        .expect(400);
      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        )
        .set(auth())
        .send({ foo: 'bar' })
        .expect(400);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('refuses an invalid amount or date', async () => {
      mocks.transactions.findById.mockResolvedValue(
        tx('00000000-0000-4000-8000-000000000016'),
      );

      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        )
        .set(auth())
        .send({ amount: 'abc' })
        .expect(400);
      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        )
        .set(auth())
        .send({ amount: '12.5' })
        .expect(400);
      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        )
        .set(auth())
        .send({ amount: '99999999999999999999999' })
        .expect(400);
      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        )
        .set(auth())
        .send({ date: 'hier' })
        .expect(400);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('only changes the provided fields', async () => {
      const existing = tx('00000000-0000-4000-8000-000000000016');
      mocks.transactions.findById.mockResolvedValue(existing);

      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        )
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

    // Le détail de toutes les routes `:id` est dans account-ownership.e2e-spec.ts.
    it('answers 404 without saving for a transaction of another account', async () => {
      mocks.transactions.findById.mockResolvedValue(
        tx('00000000-0000-4000-8000-000000000018', {
          accountId: '00000000-0000-4000-8000-000000000102',
        }),
      );

      await http()
        .patch(
          '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000119',
        )
        .set(auth())
        .send({ notes: 'x' })
        .expect(404);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });
  });

  describe('bulk routes', () => {
    it('PATCH /bulk updates the requested transactions of the account', async () => {
      await http()
        .patch('/00000000-0000-4000-8000-000000000101/transactions/bulk')
        .set(auth())
        .send({
          ids: ['00000000-0000-4000-8000-000000000016'],
          data: {
            categoryId: '00000000-0000-4000-8000-000000000013',
            pending: true,
          },
        })
        .expect(200);

      const [[[saved]]] = mocks.transactions.updateMany.mock.calls as [
        Transaction[],
      ][];
      expect(mocks.transactions.updateMany).toHaveBeenCalledTimes(1);
      expect(saved.id).toBe('00000000-0000-4000-8000-000000000016');
      expect(saved.categoryId).toBe('00000000-0000-4000-8000-000000000013');
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
        .patch('/00000000-0000-4000-8000-000000000101/transactions/bulk')
        .set(auth())
        .send({ ids: ['00000000-0000-4000-8000-000000000016'], data })
        .expect(400);

      expect(mocks.transactions.updateMany).not.toHaveBeenCalled();
    });

    it('PATCH /bulk accepts a null categoryId', async () => {
      await http()
        .patch('/00000000-0000-4000-8000-000000000101/transactions/bulk')
        .set(auth())
        .send({
          ids: ['00000000-0000-4000-8000-000000000016'],
          data: { categoryId: null },
        })
        .expect(200);

      const [[[saved]]] = mocks.transactions.updateMany.mock.calls as [
        Transaction[],
      ][];
      expect(saved.categoryId).toBeNull();
    });

    it('DELETE /bulk deletes the requested ids of the account and not the id "bulk"', async () => {
      await http()
        .delete('/00000000-0000-4000-8000-000000000101/transactions/bulk')
        .set(auth())
        .send({
          ids: [
            '00000000-0000-4000-8000-000000000016',
            '00000000-0000-4000-8000-000000000017',
          ],
        })
        .expect(204);

      expect(mocks.transactions.deleteMany.mock.calls).toEqual([
        [
          [
            '00000000-0000-4000-8000-000000000016',
            '00000000-0000-4000-8000-000000000017',
          ],
        ],
      ]);
      expect(mocks.transactions.delete).not.toHaveBeenCalled();
    });

    it('DELETE /bulk answers 404 without deleting anything when an id is unknown or foreign', async () => {
      await http()
        .delete('/00000000-0000-4000-8000-000000000101/transactions/bulk')
        .set(auth())
        .send({
          ids: [
            '00000000-0000-4000-8000-000000000016',
            '00000000-0000-4000-8000-000000000099',
          ],
        })
        .expect(404);

      expect(mocks.transactions.deleteMany).not.toHaveBeenCalled();
    });

    it('PATCH /bulk answers 404 without saving anything when an id is unknown or foreign', async () => {
      await http()
        .patch('/00000000-0000-4000-8000-000000000101/transactions/bulk')
        .set(auth())
        .send({
          ids: [
            '00000000-0000-4000-8000-000000000016',
            '00000000-0000-4000-8000-000000000099',
          ],
          data: { pending: true },
        })
        .expect(404);

      expect(mocks.transactions.updateMany).not.toHaveBeenCalled();
    });

    it('DELETE /bulk answers 400 without deleting when ids is missing', async () => {
      await http()
        .delete('/00000000-0000-4000-8000-000000000101/transactions/bulk')
        .set(auth())
        .send({})
        .expect(400);

      expect(mocks.transactions.deleteMany).not.toHaveBeenCalled();
    });
  });

  it('DELETE /:accountId/transactions/:id answers 204', async () => {
    await http()
      .delete(
        '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
      )
      .set(auth())
      .expect(204);

    expect(mocks.transactions.delete).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000111',
    );
  });

  describe('period trigger (salary category)', () => {
    const ACCOUNT = '00000000-0000-4000-8000-000000000101';
    interface TxBody {
      date: string;
      pending: boolean;
      periodId: string | null;
      periodSwitch?: { count: number };
    }
    const body = (res: { body: unknown }) => res.body as TxBody;
    const SALARY = '00000000-0000-4000-8000-000000000301';
    const BILLS = '00000000-0000-4000-8000-000000000302';
    const ACTIVE = '00000000-0000-4000-8000-000000000401';
    const day = (offset: number) =>
      toDateOnly(addDaysDateOnly(todayDateOnly(), offset));
    const today = () => toDateOnly(todayDateOnly());
    const category = (id: string, isPeriodTrigger: boolean) => ({
      id,
      accountId: ACCOUNT,
      isPeriodTrigger,
    });
    const period = (startOffset: number) =>
      new Period({
        id: ACTIVE,
        accountId: ACCOUNT,
        startDate: addDaysDateOnly(todayDateOnly(), startOffset),
        endDate: null,
        isActive: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });
    const salaryBody = (date: string, extra: object = {}) => ({
      categoryId: SALARY,
      date,
      description: 'Paie',
      amount: '200000',
      ...extra,
    });
    const switchWrites = () =>
      mocks.periods.applyPeriodSwitches.mock.calls as Array<
        [
          string,
          string,
          Array<{ closeEnd: Date; opened: Period }>,
          Transaction[],
        ]
      >;

    beforeEach(() => {
      mocks.categories.findAllByAccount.mockResolvedValue([
        category(SALARY, true),
        category(BILLS, false),
      ]);
      mocks.categories.findById.mockImplementation((id: string) =>
        Promise.resolve(category(id, id === SALARY)),
      );
      mocks.periods.findAllByAccount.mockResolvedValue([period(-60)]);
      mocks.recurring.findAllByAccount.mockResolvedValue([]);
      mocks.budgets.findTemplatesByAccount.mockResolvedValue([]);
      mocks.periods.applyPeriodSwitches.mockResolvedValue({ switched: true });
      // Relecture après l'écriture atomique : ce qui a été écrit.
      mocks.transactions.findAllByAccountUnpaginated.mockImplementation(
        (_account: string, options?: { ids?: string[] }) =>
          Promise.resolve(
            options?.ids
              ? (switchWrites()[0]?.[3] ?? []).filter((t) =>
                  options.ids?.includes(t.id),
                )
              : [],
          ),
      );
    });

    it('POST a salary dated yesterday closes the active period the day before and opens the next one, in one atomic call', async () => {
      const res = await http()
        .post(`/${ACCOUNT}/transactions`)
        .set(auth())
        .send(salaryBody(day(-1)))
        .expect(201);

      expect(mocks.periods.applyPeriodSwitches).toHaveBeenCalledTimes(1);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
      const [accountId, expectedActive, switches] = switchWrites()[0];
      expect(accountId).toBe(ACCOUNT);
      expect(expectedActive).toBe(ACTIVE);
      expect(toDateOnly(switches[0].closeEnd)).toBe(day(-2));
      expect(toDateOnly(switches[0].opened.startDate)).toBe(day(-1));
      expect(body(res).periodSwitch).toMatchObject({
        closed: { id: ACTIVE, endDate: day(-2) },
        opened: { startDate: day(-1) },
        count: 1,
        dateChanged: false,
      });
      expect(body(res).periodId).toBe(switches[0].opened.id);
    });

    it('POST a salary under 15 days after the start of the active period: saved as before, no periodSwitch', async () => {
      mocks.periods.findAllByAccount.mockResolvedValue([period(-14)]);

      const res = await http()
        .post(`/${ACCOUNT}/transactions`)
        .set(auth())
        .send(salaryBody(today()))
        .expect(201);

      expect(body(res).periodSwitch).toBeUndefined();
      expect(mocks.transactions.save).toHaveBeenCalledTimes(1);
      expect(mocks.periods.applyPeriodSwitches).not.toHaveBeenCalled();
    });

    it('POST a pending salary or a salary dated tomorrow never switches', async () => {
      await http()
        .post(`/${ACCOUNT}/transactions`)
        .set(auth())
        .send(salaryBody(day(-1), { pending: true }))
        .expect(201);
      await http()
        .post(`/${ACCOUNT}/transactions`)
        .set(auth())
        .send(salaryBody(day(1)))
        .expect(201);

      expect(mocks.periods.applyPeriodSwitches).not.toHaveBeenCalled();
      expect(mocks.transactions.save).toHaveBeenCalledTimes(2);
    });

    it('POST nothing changes while no category is marked (default setting)', async () => {
      mocks.categories.findAllByAccount.mockResolvedValue([
        category(SALARY, false),
      ]);

      const res = await http()
        .post(`/${ACCOUNT}/transactions`)
        .set(auth())
        .send(salaryBody(day(-1)))
        .expect(201);

      expect(body(res).periodSwitch).toBeUndefined();
      expect(mocks.periods.findAllByAccount).not.toHaveBeenCalled();
      expect(mocks.periods.applyPeriodSwitches).not.toHaveBeenCalled();
    });

    it('PATCH taking a salary planned in the future out of pending gives it today as date and switches', async () => {
      const id = '00000000-0000-4000-8000-000000000501';
      mocks.transactions.findById.mockResolvedValue(
        tx(id, {
          categoryId: SALARY,
          pending: true,
          date: addDaysDateOnly(todayDateOnly(), 12),
        }),
      );

      const res = await http()
        .patch(`/${ACCOUNT}/transactions/${id}`)
        .set(auth())
        // la date envoyée dans la même modification est ignorée
        .send({ pending: false, date: day(-30) })
        .expect(200);

      expect(body(res).date.slice(0, 10)).toBe(today());
      expect(body(res).pending).toBe(false);
      expect(body(res).periodSwitch).toMatchObject({
        opened: { startDate: today() },
        dateChanged: true,
      });
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('PATCH pointing (reconciled) a salary leaves pending too', async () => {
      const id = '00000000-0000-4000-8000-000000000501';
      mocks.transactions.findById.mockResolvedValue(
        tx(id, {
          categoryId: SALARY,
          pending: true,
          date: new Date('2026-01-05'),
        }),
      );

      const res = await http()
        .patch(`/${ACCOUNT}/transactions/${id}`)
        .set(auth())
        .send({ reconciled: true })
        .expect(200);

      expect(body(res).date.slice(0, 10)).toBe(today());
      expect(body(res).periodSwitch).toBeDefined();
    });

    it('PATCH taking a bill out of pending keeps its date and never switches', async () => {
      const id = '00000000-0000-4000-8000-000000000501';
      mocks.transactions.findById.mockResolvedValue(
        tx(id, {
          categoryId: BILLS,
          pending: true,
          date: new Date('2026-12-28T00:00:00.000Z'),
        }),
      );

      const res = await http()
        .patch(`/${ACCOUNT}/transactions/${id}`)
        .set(auth())
        .send({ pending: false })
        .expect(200);

      expect(body(res).date.slice(0, 10)).toBe('2026-12-28');
      expect(body(res).periodSwitch).toBeUndefined();
      expect(mocks.periods.applyPeriodSwitches).not.toHaveBeenCalled();
    });

    it('PATCH changing only the category or the description of a salary never switches', async () => {
      const id = '00000000-0000-4000-8000-000000000501';
      mocks.transactions.findById.mockResolvedValue(
        tx(id, {
          categoryId: BILLS,
          pending: false,
          date: new Date('2026-01-05'),
        }),
      );

      await http()
        .patch(`/${ACCOUNT}/transactions/${id}`)
        .set(auth())
        .send({ categoryId: SALARY })
        .expect(200);

      expect(mocks.periods.applyPeriodSwitches).not.toHaveBeenCalled();
      expect(mocks.transactions.save).toHaveBeenCalledTimes(1);
    });

    it('PATCH /bulk taking two salaries out of pending: one switch, both dated today', async () => {
      const a = '00000000-0000-4000-8000-000000000511';
      const b = '00000000-0000-4000-8000-000000000512';
      mocks.transactions.findAllByAccountUnpaginated.mockImplementation(
        (_account: string, options?: { ids?: string[] }) =>
          Promise.resolve(
            options?.ids
              ? (switchWrites()[0]?.[3] ?? [])
              : [
                  tx(a, {
                    categoryId: SALARY,
                    pending: true,
                    date: new Date('2026-12-28'),
                  }),
                  tx(b, {
                    categoryId: SALARY,
                    pending: true,
                    date: new Date('2026-11-28'),
                  }),
                ],
          ),
      );

      const res = await http()
        .patch(`/${ACCOUNT}/transactions/bulk`)
        .set(auth())
        .send({ ids: [a, b], data: { pending: false } })
        .expect(200);

      expect(body(res).periodSwitch).toMatchObject({
        count: 1,
        dateChanged: true,
      });
      const written = switchWrites()[0][3].filter((t) => [a, b].includes(t.id));
      expect(written.map((t) => toDateOnly(t.date))).toEqual([
        today(),
        today(),
      ]);
      expect(switchWrites()[0][2]).toHaveLength(1);
      expect(mocks.transactions.updateMany).not.toHaveBeenCalled();
    });

    it('POST /bulk (import) of three past salaries chains three switches, one atomic call', async () => {
      mocks.periods.findAllByAccount.mockResolvedValue([period(-120)]);

      const res = await http()
        .post(`/${ACCOUNT}/transactions/bulk`)
        .set(auth())
        .send({
          transactions: [
            salaryBody(day(-20)),
            salaryBody(day(-80)),
            salaryBody(day(-50)),
          ],
        })
        .expect(201);

      expect(mocks.periods.applyPeriodSwitches).toHaveBeenCalledTimes(1);
      expect(
        switchWrites()[0][2].map((s) => toDateOnly(s.opened.startDate)),
      ).toEqual([day(-80), day(-50), day(-20)]);
      expect(res.body as TxBody[]).toHaveLength(3);
      expect((res.body as TxBody[])[0].periodSwitch?.count).toBe(3);
      expect(mocks.transactions.saveMany).not.toHaveBeenCalled();
    });

    it('POST /bulk (import) removes the equivalent recurring pending and reports it; a simple POST does not', async () => {
      const PENDING = '11111111-1111-4111-8111-111111111111';
      mocks.periods.findAllByAccount.mockResolvedValue([period(-60)]);
      mocks.periods.applyPeriodSwitches.mockResolvedValue({
        switched: true,
        removed: 1,
      });
      const stored = Transaction.create({
        id: PENDING,
        accountId: ACCOUNT,
        categoryId: BILLS,
        description: 'Loyer',
        amount: -70000n,
        date: parseDateOnly(day(-30)),
        reconciled: false,
        pending: true,
        metadata: { source: 'recurring', recurringId: 'rec-1' },
      });
      mocks.transactions.findAllByAccountUnpaginated.mockImplementation(
        (_account: string, options?: { ids?: string[] }) =>
          Promise.resolve(
            options?.ids
              ? (switchWrites()[0]?.[3] ?? []).filter((t) =>
                  options.ids?.includes(t.id),
                )
              : [stored],
          ),
      );

      const res = await http()
        .post(`/${ACCOUNT}/transactions/bulk`)
        .set(auth())
        .send({
          transactions: [
            salaryBody(day(-20)),
            {
              categoryId: BILLS,
              date: day(-29),
              description: 'Loyer',
              amount: '-70000',
            },
          ],
        })
        .expect(201);

      expect(
        (mocks.periods.applyPeriodSwitches.mock.calls[0] as unknown[])[5],
      ).toEqual([PENDING]);
      expect((res.body as TxBody[])[0].periodSwitch).toMatchObject({
        removedPending: 1,
        remainingPending: 0,
      });

      mocks.periods.applyPeriodSwitches.mockClear();
      const single = await http()
        .post(`/${ACCOUNT}/transactions`)
        .set(auth())
        .send(salaryBody(day(-1)))
        .expect(201);
      expect(
        (mocks.periods.applyPeriodSwitches.mock.calls[0] as unknown[])[5],
      ).toEqual([]);
      expect(body(single).periodSwitch).not.toHaveProperty('removedPending');
    });

    it('answers 403 and writes nothing else for a read-only member (the atomic write refuses)', async () => {
      mocks.periods.applyPeriodSwitches.mockRejectedValue(
        new ForbiddenError(
          'You do not have permission to modify this resource',
        ),
      );

      await http()
        .post(`/${ACCOUNT}/transactions`)
        .set(auth())
        .send(salaryBody(day(-1)))
        .expect(403);

      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('answers 409 when the new period would overlap another one, without separate writes', async () => {
      mocks.periods.applyPeriodSwitches.mockRejectedValue(
        new ConflictError('Period overlaps an existing period'),
      );

      await http()
        .post(`/${ACCOUNT}/transactions`)
        .set(auth())
        .send(salaryBody(day(-1)))
        .expect(409);

      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('a lost concurrent switch answers 201 without periodSwitch (saved without switch)', async () => {
      mocks.periods.applyPeriodSwitches.mockResolvedValue({ switched: false });

      const res = await http()
        .post(`/${ACCOUNT}/transactions`)
        .set(auth())
        .send(salaryBody(day(-1)))
        .expect(201);

      expect(body(res).periodSwitch).toBeUndefined();
    });
  });
});
