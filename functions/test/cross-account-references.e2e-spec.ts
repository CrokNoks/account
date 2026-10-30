import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks, USER } from './e2e-app';
import { Account } from '../src/accounts/domain/account.entity';
import { AccountShare } from '../src/accounts/domain/account-share.entity';
import { Transaction } from '../src/transactions/domain/transaction.entity';

/**
 * Les références (catégorie, étiquettes, objectif d'épargne) envoyées sous
 * `/:accountId/...` doivent appartenir au compte de l'URL : 400 sans aucune
 * écriture sinon. Les destinations de virement doivent être accessibles en
 * écriture, les transactions ignorées (anomalies) appartenir au compte.
 */
const now = new Date('2026-01-01T00:00:00.000Z');

const tx = (id = '00000000-0000-4000-8000-000000000016') =>
  Transaction.create({
    id,
    accountId: '00000000-0000-4000-8000-000000000101',
    categoryId: null,
    date: now,
    description: 'tx',
    amount: BigInt(-100),
    reconciled: false,
    pending: false,
  });

type Method = 'post' | 'patch' | 'put';
interface Route {
  name: string;
  method: Method;
  url: string;
  body: (refs: { category?: string; tags?: string[]; goal?: string }) => object;
  writes: string[];
  okStatus: number;
  /** Références prises en charge par la route. */
  supports: Array<'category' | 'tags' | 'goal'>;
}

const txBody = (r: { category?: string; tags?: string[]; goal?: string }) => ({
  date: '2026-03-01',
  description: 'CB',
  amount: '-100',
  ...(r.category && { categoryId: r.category }),
  ...(r.tags && { tagIds: r.tags }),
  ...(r.goal && { savingsGoalId: r.goal }),
});

const routes: Route[] = [
  {
    name: 'POST transactions',
    method: 'post',
    url: '/00000000-0000-4000-8000-000000000101/transactions',
    body: txBody,
    writes: ['transactions.save'],
    okStatus: 201,
    supports: ['category', 'tags', 'goal'],
  },
  {
    name: 'PATCH transactions/:id',
    method: 'patch',
    url: '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
    body: ({ category, tags, goal }) => ({
      ...(category && { categoryId: category }),
      ...(tags && { tagIds: tags }),
      ...(goal && { savingsGoalId: goal }),
    }),
    writes: ['transactions.save'],
    okStatus: 200,
    supports: ['category', 'tags', 'goal'],
  },
  {
    name: 'POST transactions/bulk',
    method: 'post',
    url: '/00000000-0000-4000-8000-000000000101/transactions/bulk',
    // la 1re ligne est saine : rien ne doit être écrit quand la 2e est refusée
    body: (r) => ({ transactions: [txBody({}), txBody(r)] }),
    writes: ['transactions.save'],
    okStatus: 201,
    supports: ['category', 'tags', 'goal'],
  },
  {
    name: 'PATCH transactions/bulk',
    method: 'patch',
    url: '/00000000-0000-4000-8000-000000000101/transactions/bulk',
    body: ({ category, tags }) => ({
      ids: ['00000000-0000-4000-8000-000000000016'],
      data: {
        ...(category && { categoryId: category }),
        ...(tags && { tagIds: tags }),
      },
    }),
    writes: ['transactions.save'],
    okStatus: 200,
    supports: ['category', 'tags'],
  },
  {
    name: 'POST recurring',
    method: 'post',
    url: '/00000000-0000-4000-8000-000000000101/recurring',
    body: ({ category }) => ({
      categoryId: category ?? null,
      description: 'Loyer',
      amount: '-50000',
      dayOfMonth: 5,
    }),
    writes: ['recurring.save'],
    okStatus: 201,
    supports: ['category'],
  },
  {
    name: 'PATCH recurring/:id',
    method: 'patch',
    url: '/00000000-0000-4000-8000-000000000101/recurring/00000000-0000-4000-8000-000000000114',
    body: ({ category }) => ({ categoryId: category }),
    writes: ['recurring.save'],
    okStatus: 200,
    supports: ['category'],
  },
  {
    name: 'POST smart-rules',
    method: 'post',
    url: '/00000000-0000-4000-8000-000000000101/smart-rules',
    body: ({ category, tags }) => ({
      pattern: 'carrefour',
      categoryId: category ?? null,
      ...(tags && { tagIds: tags }),
    }),
    writes: ['smartRules.save'],
    okStatus: 201,
    supports: ['category', 'tags'],
  },
  {
    name: 'PATCH smart-rules/:id',
    method: 'patch',
    url: '/00000000-0000-4000-8000-000000000101/smart-rules/00000000-0000-4000-8000-000000000115',
    body: ({ category, tags }) => ({
      ...(category && { categoryId: category }),
      ...(tags && { tagIds: tags }),
    }),
    writes: ['smartRules.save'],
    okStatus: 200,
    supports: ['category', 'tags'],
  },
  {
    name: 'POST periods (budgets)',
    method: 'post',
    url: '/00000000-0000-4000-8000-000000000101/periods',
    body: ({ category }) => ({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      budgets: [{ categoryId: category, amountAllocated: '100' }],
    }),
    writes: ['periods.save', 'budgets.saveBulk'],
    okStatus: 201,
    supports: ['category'],
  },
  {
    name: 'PUT periods/:id/budgets',
    method: 'put',
    url: '/00000000-0000-4000-8000-000000000101/periods/00000000-0000-4000-8000-000000000113/budgets',
    body: ({ category }) => ({
      budgets: [{ categoryId: category, amountAllocated: '100' }],
    }),
    writes: ['budgets.deleteAllByPeriod', 'budgets.saveBulk'],
    okStatus: 200,
    supports: ['category'],
  },
];

describe('Cross-account references (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });
  afterAll(() => app.close());

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of Object.values(mocks)) {
      for (const fn of ['save', 'delete', 'saveBulk', 'deleteAllByPeriod']) {
        m[fn].mockResolvedValue(undefined);
      }
    }
    const owner = (id: string, accountId: string) => ({ id, accountId });
    mocks.categories.findById.mockImplementation((id: string) =>
      Promise.resolve(
        id === '00000000-0000-4000-8000-000000000001'
          ? owner(id, '00000000-0000-4000-8000-000000000101')
          : id === '00000000-0000-4000-8000-000000000002'
            ? owner(id, '00000000-0000-4000-8000-000000000102')
            : id === '00000000-0000-4000-8000-000000000003'
              ? owner(id, null as unknown as string)
              : null,
      ),
    );
    mocks.tags.findById.mockImplementation((id: string) =>
      Promise.resolve(
        id === '00000000-0000-4000-8000-000000000005'
          ? owner(id, '00000000-0000-4000-8000-000000000101')
          : id === '00000000-0000-4000-8000-000000000006'
            ? owner(id, '00000000-0000-4000-8000-000000000102')
            : null,
      ),
    );
    mocks.savingsGoals.findById.mockImplementation((id: string) =>
      Promise.resolve(
        id === '00000000-0000-4000-8000-000000000007'
          ? owner(id, '00000000-0000-4000-8000-000000000101')
          : id === '00000000-0000-4000-8000-000000000008'
            ? owner(id, '00000000-0000-4000-8000-000000000102')
            : null,
      ),
    );
    mocks.transactions.findById.mockResolvedValue(tx());
    mocks.transactions.findAllByAccountUnpaginated.mockResolvedValue([tx()]);
    mocks.smartRules.findAllByAccount.mockResolvedValue([]);
    mocks.recurring.findAllByAccount.mockResolvedValue([]);
    mocks.periods.findAllByAccount.mockResolvedValue([]);
    mocks.periods.findById.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000113',
      accountId: '00000000-0000-4000-8000-000000000101',
    });
    mocks.recurring.findById.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000114',
      accountId: '00000000-0000-4000-8000-000000000101',
      categoryId: null,
      description: 'Loyer',
      amount: BigInt(-50000),
      dayOfMonth: 5,
      createdAt: now,
      updatedAt: now,
    });
    mocks.smartRules.findById.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000115',
      accountId: '00000000-0000-4000-8000-000000000101',
      pattern: 'x',
      categoryId: null,
      tagIds: [],
      priority: 0,
      createdAt: now,
      updatedAt: now,
      updatePattern: jest.fn(),
      updateCategory: jest.fn(),
      updateTags: jest.fn(),
      updatePriority: jest.fn(),
    });
  });

  const expectNoWrite = (r: Route) => {
    for (const w of r.writes) {
      const [repo, fn] = w.split('.');
      expect(mocks[repo as keyof Mocks][fn]).not.toHaveBeenCalled();
    }
  };

  describe.each(routes)('$name', (r) => {
    const send = (refs: Parameters<Route['body']>[0]) =>
      http()[r.method](r.url).set(auth()).send(r.body(refs));

    it('accepts references of the account of the URL', async () => {
      await send({
        category: '00000000-0000-4000-8000-000000000001',
        ...(r.supports.includes('tags') && {
          tags: ['00000000-0000-4000-8000-000000000005'],
        }),
        ...(r.supports.includes('goal') && {
          goal: '00000000-0000-4000-8000-000000000007',
        }),
      }).expect(r.okStatus);
    });

    it.each([
      [
        'a category of another account',
        { category: '00000000-0000-4000-8000-000000000002' },
      ],
      [
        'a global category',
        { category: '00000000-0000-4000-8000-000000000003' },
      ],
      [
        'an unknown category',
        { category: '00000000-0000-4000-8000-000000000004' },
      ],
    ])('answers 400 without writing for %s', async (_label, refs) => {
      const res = await send(refs).expect(400);
      expect((res.body as { message: string }).message).toBe(
        'Category does not belong to this account',
      );
      expectNoWrite(r);
    });

    if (r.supports.includes('tags')) {
      it('answers 400 without writing for a tag of another account', async () => {
        await send({
          category: '00000000-0000-4000-8000-000000000001',
          tags: [
            '00000000-0000-4000-8000-000000000005',
            '00000000-0000-4000-8000-000000000006',
          ],
        })
          .expect(400)
          .expect(({ body }) =>
            expect((body as { message: string }).message).toBe(
              'Tag does not belong to this account',
            ),
          );
        expectNoWrite(r);
      });
    }

    if (r.supports.includes('goal')) {
      it('answers 400 without writing for a savings goal of another account', async () => {
        await send({
          category: '00000000-0000-4000-8000-000000000001',
          goal: '00000000-0000-4000-8000-000000000008',
        })
          .expect(400)
          .expect(({ body }) =>
            expect((body as { message: string }).message).toBe(
              'Savings goal does not belong to this account',
            ),
          );
        expectNoWrite(r);
      });
    }
  });

  describe('periodId of a transaction', () => {
    const periodRoutes: Array<{
      name: string;
      method: 'post' | 'patch';
      url: string;
      body: (periodId: string | null) => object;
      okStatus: number;
    }> = [
      {
        name: 'POST transactions',
        method: 'post',
        url: '/00000000-0000-4000-8000-000000000101/transactions',
        body: (periodId) => ({ ...txBody({}), periodId }),
        okStatus: 201,
      },
      {
        name: 'PATCH transactions/:id',
        method: 'patch',
        url: '/00000000-0000-4000-8000-000000000101/transactions/00000000-0000-4000-8000-000000000111',
        body: (periodId) => ({ periodId }),
        okStatus: 200,
      },
      {
        name: 'POST transactions/bulk',
        method: 'post',
        url: '/00000000-0000-4000-8000-000000000101/transactions/bulk',
        body: (periodId) => ({
          transactions: [txBody({}), { ...txBody({}), periodId }],
        }),
        okStatus: 201,
      },
    ];

    beforeEach(() => {
      mocks.periods.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === '00000000-0000-4000-8000-000000000009'
            ? { id, accountId: '00000000-0000-4000-8000-000000000101' }
            : id === '00000000-0000-4000-8000-000000000010'
              ? { id, accountId: '00000000-0000-4000-8000-000000000102' }
              : null,
        ),
      );
    });

    describe.each(periodRoutes)('$name', (r) => {
      const send = (periodId: string | null) =>
        http()[r.method](r.url).set(auth()).send(r.body(periodId));

      it('accepts a period of the account, or no period', async () => {
        await send('00000000-0000-4000-8000-000000000009').expect(r.okStatus);
        await send(null).expect(r.okStatus);
      });

      it.each([
        ['a period of another account', '00000000-0000-4000-8000-000000000010'],
        ['an unknown period', '00000000-0000-4000-8000-000000000011'],
      ])('answers 400 without writing for %s', async (_label, periodId) => {
        const res = await send(periodId).expect(400);
        expect((res.body as { message: string }).message).toBe(
          'Period does not belong to this account',
        );
        expect(mocks.transactions.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('PATCH /accounts/:id', () => {
    const account = (ownerId: string) =>
      new Account({
        id: '00000000-0000-4000-8000-000000000101',
        name: 'Courant',
        ownerId,
        createdAt: now,
        updatedAt: now,
      });

    it('lets the owner update the account', async () => {
      mocks.accounts.findById.mockResolvedValue(account(USER.id));
      await http()
        .patch('/accounts/00000000-0000-4000-8000-000000000101')
        .set(auth())
        .send({ name: 'Renommé' })
        .expect(200)
        .expect(({ body }) =>
          expect((body as { name: string }).name).toBe('Renommé'),
        );
      expect(mocks.accounts.save).toHaveBeenCalledTimes(1);
    });

    it('answers 403 without writing for a user who only has a share', async () => {
      mocks.accounts.findById.mockResolvedValue(
        account('00000000-0000-4000-8000-000000000104'),
      );
      await http()
        .patch('/accounts/00000000-0000-4000-8000-000000000101')
        .set(auth())
        .send({ name: 'Piraté' })
        .expect(403);
      expect(mocks.accounts.save).not.toHaveBeenCalled();
    });

    it('answers 404 without writing for an unknown account', async () => {
      mocks.accounts.findById.mockResolvedValue(null);
      await http()
        .patch('/accounts/00000000-0000-4000-8000-000000000199')
        .set(auth())
        .send({ name: 'x' })
        .expect(404);
      expect(mocks.accounts.save).not.toHaveBeenCalled();
    });
  });

  describe('POST /:accountId/transactions/transfer', () => {
    const body = {
      destinationAccountId: '00000000-0000-4000-8000-000000000014',
      date: '2026-03-01',
      description: 'Épargne',
      amount: '15000',
    };
    const send = () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/transactions/transfer')
        .set(auth())
        .send(body);
    const destination = (ownerId: string) =>
      new Account({
        id: '00000000-0000-4000-8000-000000000014',
        name: 'Dest',
        ownerId,
      });

    it('works toward an account owned by the caller', async () => {
      mocks.accounts.findById.mockResolvedValue(destination(USER.id));
      await send().expect(201);
      expect(mocks.transactions.save).toHaveBeenCalledTimes(2);
    });

    it('works toward an account shared with write permission', async () => {
      mocks.accounts.findById.mockResolvedValue(
        destination('00000000-0000-4000-8000-000000000104'),
      );
      mocks.shares.findAllByAccount.mockResolvedValue([
        new AccountShare({
          accountId: '00000000-0000-4000-8000-000000000014',
          userId: USER.id,
          permission: 'write',
        }),
      ]);
      await send().expect(201);
      expect(mocks.transactions.save).toHaveBeenCalledTimes(2);
    });

    it('answers 404 without writing for an unknown or invisible destination', async () => {
      mocks.accounts.findById.mockResolvedValue(null);
      await send().expect(404);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('answers 403 without writing for a destination shared in read only', async () => {
      mocks.accounts.findById.mockResolvedValue(
        destination('00000000-0000-4000-8000-000000000104'),
      );
      mocks.shares.findAllByAccount.mockResolvedValue([
        new AccountShare({
          accountId: '00000000-0000-4000-8000-000000000014',
          userId: USER.id,
          permission: 'read',
        }),
      ]);
      await send().expect(403);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });
  });

  describe('POST /:accountId/reporting/anomalies/ignore', () => {
    const send = (ids: string[]) =>
      http()
        .post(
          '/00000000-0000-4000-8000-000000000101/reporting/anomalies/ignore',
        )
        .set(auth())
        .send({ transactionIds: ids, type: 'outlier' });

    it('marks transactions of the account', async () => {
      await send(['00000000-0000-4000-8000-000000000016']).expect(201, {
        success: true,
      });
      expect(mocks.transactions.save).toHaveBeenCalledTimes(1);
    });

    it('answers 404 without writing when a transaction is of another account', async () => {
      mocks.transactions.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === '00000000-0000-4000-8000-000000000016'
            ? tx()
            : Transaction.create({
                id,
                accountId: '00000000-0000-4000-8000-000000000102',
                categoryId: null,
                date: now,
                description: 'x',
                amount: BigInt(-1),
                reconciled: false,
                pending: false,
              }),
        ),
      );
      await send([
        '00000000-0000-4000-8000-000000000016',
        '00000000-0000-4000-8000-000000000018',
      ]).expect(404);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });

    it('answers 404 without writing for an unknown transaction', async () => {
      mocks.transactions.findById.mockResolvedValue(null);
      await send(['00000000-0000-4000-8000-000000000042']).expect(404);
      expect(mocks.transactions.save).not.toHaveBeenCalled();
    });
  });
});
