import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2EApp, Mocks, token, USER } from './e2e-app';
import { UserPreferences } from '../src/preferences/domain/user-preferences.entity';

describe('Health and authentication (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mocks.preferences.findByUserId.mockResolvedValue(
      UserPreferences.create(USER.id),
    );
    mocks.tags.findAllByAccount.mockResolvedValue([]);
  });

  it('GET /health is public', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toMatchObject({ status: 'ok' });
  });

  describe('protected routes', () => {
    const routes = [
      ['get', '/accounts'],
      ['get', '/preferences'],
      ['get', '/acc-1/transactions'],
      ['get', '/acc-1/tags'],
      ['get', '/acc-1/categories'],
      ['get', '/acc-1/periods'],
      ['get', '/acc-1/recurring'],
      ['get', '/acc-1/smart-rules'],
      ['get', '/acc-1/savings-goals'],
      ['get', '/acc-1/reporting/net-worth'],
      ['post', '/acc-1/reporting/scan-receipt'],
    ] as const;

    it.each(routes)('%s %s rejects a request without token', (method, url) =>
      request(app.getHttpServer())[method](url).expect(401),
    );

    it('rejects a token signed with another secret', () =>
      request(app.getHttpServer())
        .get('/acc-1/tags')
        .set('Authorization', `Bearer ${token(undefined, undefined, 'wrong')}`)
        .expect(401));

    it('rejects an expired token', () =>
      request(app.getHttpServer())
        .get('/acc-1/tags')
        .set(
          'Authorization',
          `Bearer ${token(
            {
              sub: USER.id,
              email: USER.email,
              exp: Math.floor(Date.now() / 1000) - 60,
            },
            {},
          )}`,
        )
        .expect(401));

    it('rejects a token without subject', () =>
      request(app.getHttpServer())
        .get('/acc-1/tags')
        .set('Authorization', `Bearer ${token({ email: USER.email })}`)
        .expect(401));

    it('rejects a malformed Authorization header', () =>
      request(app.getHttpServer())
        .get('/acc-1/tags')
        .set('Authorization', token())
        .expect(401));

    it('accepts a valid token and exposes its subject as the user', async () => {
      await request(app.getHttpServer())
        .get('/preferences')
        .set('Authorization', `Bearer ${token()}`)
        .expect(200);

      expect(mocks.preferences.findByUserId).toHaveBeenCalledWith(USER.id);
    });
  });
});
