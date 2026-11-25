import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks } from './e2e-app';

/** Règle : on ne crée pas une période qui commence avant une période existante du compte. */
const ACCOUNT = '00000000-0000-4000-8000-000000000101';
const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

describe('POST /:accountId/periods ordering (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const post = (startDate: string, endDate: string) =>
    request(app.getHttpServer())
      .post(`/${ACCOUNT}/periods`)
      .set(auth())
      .send({ startDate, endDate, budgets: [] });

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });
  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mocks.recurring.findAllByAccount.mockResolvedValue([]);
    mocks.periods.createWithBudgets.mockResolvedValue(undefined);
    mocks.periods.findAllByAccount.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000202',
        accountId: ACCOUNT,
        startDate: day('2026-04-01'),
        endDate: day('2026-04-30'),
        estimatedEndDate: null,
        isActive: true,
        createdAt: day('2026-01-01'),
        updatedAt: day('2026-01-01'),
      },
    ]);
  });

  it('refuses 409 PERIOD_BEFORE_EXISTING a period starting before an existing one, without writing', async () => {
    const res = await post('2026-03-01', '2026-03-31').expect(409);
    expect(res.body).toMatchObject({
      statusCode: 409,
      code: 'PERIOD_BEFORE_EXISTING',
    });
    expect(mocks.periods.createWithBudgets).not.toHaveBeenCalled();
  });

  it('accepts a period starting after the existing ones', async () => {
    await post('2026-05-01', '2026-05-31').expect(201);
    expect(mocks.periods.createWithBudgets).toHaveBeenCalledTimes(1);
  });

  it('injects the recurring of the second month of a period spanning two months (25 Oct to 24 Nov, day 5)', async () => {
    mocks.periods.findAllByAccount.mockResolvedValue([]);
    mocks.recurring.findAllByAccount.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000301',
        accountId: ACCOUNT,
        categoryId: null,
        description: 'Loyer',
        amount: BigInt(-50000),
        dayOfMonth: 5,
      },
    ]);

    await request(app.getHttpServer())
      .post(`/${ACCOUNT}/periods`)
      .set(auth())
      .send({
        startDate: '2026-10-25',
        endDate: '2026-11-24',
        budgets: [],
        injectRecurring: true,
      })
      .expect(201);

    const [, , generated] = mocks.periods.createWithBudgets.mock.calls[0] as [
      unknown,
      unknown,
      Array<{ date: Date; pending: boolean }>,
    ];
    expect(generated.map((t) => t.date.toISOString().slice(0, 10))).toEqual([
      '2026-11-05',
    ]);
    expect(generated[0].pending).toBe(true);
  });
});
