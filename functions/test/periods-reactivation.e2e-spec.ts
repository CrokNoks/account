import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks } from './e2e-app';

/**
 * Règle : on ne peut pas réactiver une ancienne période, seule la dernière
 * (start_date la plus récente du compte) peut l'être.
 */
const ACCOUNT = '00000000-0000-4000-8000-000000000101';
const OTHER_ACCOUNT = '00000000-0000-4000-8000-000000000102';
const OLD = '00000000-0000-4000-8000-000000000201';
const LAST = '00000000-0000-4000-8000-000000000202';
const FOREIGN = '00000000-0000-4000-8000-000000000203';
const day = (d: string) => new Date(`${d}T00:00:00.000Z`);
const now = day('2026-01-01');

const period = (
  id: string,
  startDate: string,
  endDate: string | null,
  isActive: boolean,
  accountId = ACCOUNT,
) => ({
  id,
  accountId,
  startDate: day(startDate),
  endDate: endDate ? day(endDate) : null,
  estimatedEndDate: null,
  isActive,
  createdAt: now,
  updatedAt: now,
});

describe('PATCH /:accountId/periods/:id reactivation (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const patch = (id: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch(`/${ACCOUNT}/periods/${id}`)
      .set(auth())
      .send(body);

  const old = period(OLD, '2026-01-01', '2026-01-31', false);
  const last = period(LAST, '2026-02-01', '2026-02-28', false);
  const all = (...extra: ReturnType<typeof period>[]) => [last, old, ...extra];

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });
  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mocks.periods.save.mockResolvedValue(undefined);
    mocks.periods.findAllByAccount.mockResolvedValue(all());
    mocks.periods.findById.mockImplementation((id: string) =>
      Promise.resolve([old, last].find((p) => p.id === id) ?? null),
    );
  });

  it('refuses 409 PERIOD_NOT_LATEST to reactivate a period when a more recent one exists', async () => {
    const res = await patch(OLD, { isActive: true }).expect(409);
    expect(res.body).toMatchObject({
      statusCode: 409,
      code: 'PERIOD_NOT_LATEST',
    });
    expect(mocks.periods.save).not.toHaveBeenCalled();
  });

  it('allows to reactivate the most recent period', async () => {
    await patch(LAST, { isActive: true }).expect(200);
    expect(mocks.periods.save).toHaveBeenCalledTimes(1);
  });

  it('judges on the resulting dates when startDate and isActive change together', async () => {
    await patch(OLD, {
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      isActive: true,
    }).expect(200);
    jest.clearAllMocks();
    await patch(LAST, {
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      isActive: true,
    }).expect(409);
    expect(mocks.periods.save).not.toHaveBeenCalled();
  });

  it('is not blocked by a period of another account', async () => {
    mocks.periods.findAllByAccount.mockResolvedValue(
      all(period(FOREIGN, '2027-01-01', '2027-01-31', false, OTHER_ACCOUNT)),
    );
    await patch(LAST, { isActive: true }).expect(200);
  });

  it('is not blocked by a period with the same start date', async () => {
    mocks.periods.findAllByAccount.mockResolvedValue(
      all(period(FOREIGN, '2026-02-01', '2026-02-10', false)),
    );
    await patch(LAST, { isActive: true }).expect(200);
  });

  it('still allows changing the dates of an old period without activating it', async () => {
    await patch(OLD, { endDate: '2026-01-30' }).expect(200);
    await patch(OLD, { isActive: false }).expect(200);
  });

  it('still allows to edit or close an already active period, even if not the last', async () => {
    const active = period(OLD, '2026-01-01', '2026-01-31', true);
    mocks.periods.findById.mockResolvedValue(active);
    await patch(OLD, { isActive: true, endDate: '2026-01-30' }).expect(200);
    await patch(OLD, { isActive: false }).expect(200);
  });

  describe('moving the start date of an active period', () => {
    const active = period(LAST, '2026-02-01', '2026-02-28', true);
    const before = period(OLD, '2026-01-01', '2026-01-31', false);
    const next = period(FOREIGN, '2026-04-01', '2026-04-30', false);

    beforeEach(() => {
      mocks.periods.findById.mockResolvedValue(active);
      mocks.periods.findAllByAccount.mockResolvedValue([next, active, before]);
    });

    it('refuses 409 PERIOD_BEFORE_EXISTING when the active period would start before another one, and writes nothing', async () => {
      mocks.periods.findAllByAccount.mockResolvedValue([active, before]);
      const res = await patch(LAST, {
        startDate: '2025-11-01',
        endDate: '2025-11-30',
      }).expect(409);
      expect(res.body).toMatchObject({
        statusCode: 409,
        code: 'PERIOD_BEFORE_EXISTING',
      });
      expect(mocks.periods.save).not.toHaveBeenCalled();
    });

    it('allows moving the start date of an active period that stays the latest', async () => {
      mocks.periods.findAllByAccount.mockResolvedValue([active]);
      await patch(LAST, { startDate: '2026-02-05' }).expect(200);
    });

    it('does not block closing or changing the end date of an active period already before another, nor resending its unchanged start date', async () => {
      await patch(LAST, { isActive: false }).expect(200);
      await patch(LAST, { endDate: '2026-02-27' }).expect(200);
      await patch(LAST, {
        startDate: '2026-02-01',
        endDate: '2026-02-27',
        isActive: true,
      }).expect(200);
      expect(mocks.periods.save).toHaveBeenCalledTimes(3);
    });

    it('allows moving the dates of a closed period', async () => {
      mocks.periods.findById.mockResolvedValue(before);
      await patch(OLD, { startDate: '2025-12-01' }).expect(200);
    });
  });
});
