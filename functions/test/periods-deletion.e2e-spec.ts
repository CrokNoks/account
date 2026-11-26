import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ForbiddenError, NotFoundError } from '../src/shared/domain/errors';
import { auth, createE2EApp, Mocks } from './e2e-app';

/**
 * Suppression d'une période : DELETE /:accountId/periods/:id et son aperçu
 * GET /:accountId/periods/:id/deletion-preview. La règle (périmètre, réouverture)
 * vit en SQL (supabase/tests/delete_period_test.sql) ; ici, les routes et les erreurs HTTP.
 */
const ACCOUNT = '00000000-0000-4000-8000-000000000101';
const OTHER_ACCOUNT = '00000000-0000-4000-8000-000000000102';
const PERIOD = '00000000-0000-4000-8000-000000000201';
const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

const period = (accountId = ACCOUNT) => ({
  id: PERIOD,
  accountId,
  startDate: day('2026-11-25'),
  endDate: day('2026-12-24'),
  estimatedEndDate: null,
  isActive: true,
  createdAt: day('2026-11-25'),
  updatedAt: day('2026-11-25'),
});

describe('DELETE /:accountId/periods/:id (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const del = () =>
    request(app.getHttpServer())
      .delete(`/${ACCOUNT}/periods/${PERIOD}`)
      .set(auth());
  const preview = () =>
    request(app.getHttpServer())
      .get(`/${ACCOUNT}/periods/${PERIOD}/deletion-preview`)
      .set(auth());

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });
  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mocks.periods.findById.mockResolvedValue(period());
    mocks.periods.delete.mockResolvedValue({
      removedPending: 4,
      keptTransactions: 5,
      reopenedPeriodId: null,
      origin: 'manual',
    });
    mocks.periods.previewDelete.mockResolvedValue({
      removedPending: 4,
      keptTransactions: 5,
      reopen: {
        periodId: 'p-old',
        startDate: '2026-10-25',
        endDate: '2026-11-30',
      },
      origin: 'trigger',
    });
  });

  it('answers 204 without a body and deletes once', async () => {
    const res = await del().expect(204);
    expect(res.text).toBe('');
    expect(mocks.periods.delete).toHaveBeenCalledTimes(1);
    expect(mocks.periods.delete).toHaveBeenCalledWith(PERIOD);
  });

  it('answers 404 and deletes nothing for a period of another account', async () => {
    mocks.periods.findById.mockResolvedValue(period(OTHER_ACCOUNT));
    await del().expect(404);
    expect(mocks.periods.delete).not.toHaveBeenCalled();
  });

  it('answers 403 when the database refuses (read-only access): no 204 any more', async () => {
    mocks.periods.delete.mockRejectedValue(new ForbiddenError('read only'));
    await del().expect(403);
  });

  it('answers 404 when the period disappeared meanwhile', async () => {
    mocks.periods.delete.mockRejectedValue(new NotFoundError('gone'));
    await del().expect(404);
  });

  it('refuses without a token', async () => {
    await request(app.getHttpServer())
      .delete(`/${ACCOUNT}/periods/${PERIOD}`)
      .expect(401);
    expect(mocks.periods.delete).not.toHaveBeenCalled();
  });

  describe('deletion preview', () => {
    it('returns the numbers and the reopened period, never a write', async () => {
      const res = await preview().expect(200);
      expect(res.body).toEqual({
        removedPending: 4,
        keptTransactions: 5,
        reopen: {
          periodId: 'p-old',
          startDate: '2026-10-25',
          endDate: '2026-11-30',
        },
        origin: 'trigger',
      });
      expect(mocks.periods.delete).not.toHaveBeenCalled();
    });

    it('answers 404 for a period of another account', async () => {
      mocks.periods.findById.mockResolvedValue(period(OTHER_ACCOUNT));
      await preview().expect(404);
      expect(mocks.periods.previewDelete).not.toHaveBeenCalled();
    });

    it('refuses without a token', async () => {
      await request(app.getHttpServer())
        .get(`/${ACCOUNT}/periods/${PERIOD}/deletion-preview`)
        .expect(401);
    });
  });
});
