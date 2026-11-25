import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks } from './e2e-app';
import { ForbiddenError, NotFoundError } from '../src/shared/domain/errors';

/** CA1 : une catégorie par compte peut être marquée « déclencheur de période ». */
const ACCOUNT = '00000000-0000-4000-8000-000000000101';
const CATEGORY = '00000000-0000-4000-8000-000000000107';
const now = new Date('2026-01-01T00:00:00.000Z');
const category = (accountId: string | null, isPeriodTrigger = false) => ({
  id: CATEGORY,
  accountId,
  name: 'Salaire',
  description: null,
  color: '#111111',
  type: 'income',
  isPeriodTrigger,
  createdAt: now,
  updatedAt: now,
});

describe('PATCH /:accountId/categories/:id isPeriodTrigger (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const patch = (body: object, accountId = ACCOUNT) =>
    request(app.getHttpServer())
      .patch(`/${accountId}/categories/${CATEGORY}`)
      .set(auth())
      .send(body);

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });
  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mocks.categories.findById.mockResolvedValue(category(ACCOUNT));
    mocks.categories.setPeriodTrigger.mockResolvedValue(undefined);
    mocks.categories.save.mockResolvedValue(undefined);
  });

  it('marks the category through the atomic setting and returns the mark', async () => {
    const res = await patch({ isPeriodTrigger: true }).expect(200);

    expect(mocks.categories.setPeriodTrigger).toHaveBeenCalledWith(
      CATEGORY,
      true,
    );
    expect(res.body).toMatchObject({ isPeriodTrigger: true });
  });

  it('removes the mark', async () => {
    mocks.categories.findById.mockResolvedValue(category(ACCOUNT, true));

    const res = await patch({ isPeriodTrigger: false }).expect(200);

    expect(mocks.categories.setPeriodTrigger).toHaveBeenCalledWith(
      CATEGORY,
      false,
    );
    expect(res.body).toMatchObject({ isPeriodTrigger: false });
  });

  it('does not touch the setting when the field is absent, and keeps the mark', async () => {
    mocks.categories.findById.mockResolvedValue(category(ACCOUNT, true));

    const res = await patch({ name: 'Paie' }).expect(200);

    expect(mocks.categories.setPeriodTrigger).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ isPeriodTrigger: true });
  });

  it('does not call the setting when the value equals the existing one', async () => {
    mocks.categories.findById.mockResolvedValue(category(ACCOUNT, true));
    await patch({ isPeriodTrigger: true, name: 'Paie' }).expect(200);

    mocks.categories.findById.mockResolvedValue(category(ACCOUNT, false));
    await patch({ isPeriodTrigger: false, name: 'Paie' }).expect(200);

    expect(mocks.categories.setPeriodTrigger).not.toHaveBeenCalled();
  });

  it('marks any category type', async () => {
    mocks.categories.findById.mockResolvedValue({
      ...category(ACCOUNT),
      type: 'expense',
    });

    await patch({ isPeriodTrigger: true }).expect(200);

    expect(mocks.categories.setPeriodTrigger).toHaveBeenCalledTimes(1);
  });

  it('refuses a category of another account (404) and never marks it', async () => {
    mocks.categories.findById.mockResolvedValue(
      category('00000000-0000-4000-8000-000000000999'),
    );

    await patch({ isPeriodTrigger: true }).expect(404);

    expect(mocks.categories.setPeriodTrigger).not.toHaveBeenCalled();
    expect(mocks.categories.save).not.toHaveBeenCalled();
  });

  it('answers 404 when the base does not see the category, 403 for a read-only member', async () => {
    mocks.categories.setPeriodTrigger.mockRejectedValueOnce(
      new NotFoundError('Category not found'),
    );
    await patch({ isPeriodTrigger: true }).expect(404);

    mocks.categories.setPeriodTrigger.mockRejectedValueOnce(
      new ForbiddenError('no'),
    );
    await patch({ isPeriodTrigger: true }).expect(403);
    expect(mocks.categories.save).not.toHaveBeenCalled();
  });

  it('refuses null and non boolean values without any write', async () => {
    await patch({ isPeriodTrigger: null }).expect(400);
    await patch({ isPeriodTrigger: 'yes' }).expect(400);

    expect(mocks.categories.setPeriodTrigger).not.toHaveBeenCalled();
  });
});
