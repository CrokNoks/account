import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp } from './e2e-app';

describe('Validation refusals are logged (e2e)', () => {
  let app: INestApplication<App>;
  const acc = '00000000-0000-4000-8000-000000000101';

  beforeAll(async () => {
    ({ app } = await createE2EApp());
  });
  afterAll(() => app.close());

  it('logs the route and the messages of a 400, never the body values', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const secret = 'LIBELLE BANCAIRE CONFIDENTIEL';

    const res = await request(app.getHttpServer())
      .post(`/${acc}/transactions/bulk`)
      .set(auth())
      .send({
        transactions: [
          { date: 'pas une date', description: secret, amount: '-100' },
        ],
      })
      .expect(400);

    expect((res.body as { message?: unknown }).message).toBeDefined(); // same answer as before
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain('POST');
    expect(line).toContain(':accountId/transactions/bulk');
    expect(line).toContain('transactions.0.date');
    expect(line).not.toContain(secret);
    expect(line).not.toContain('pas une date');
    warn.mockRestore();
  });
});
