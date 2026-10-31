import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks, USER } from './e2e-app';
import { Account } from '../src/accounts/domain/account.entity';
import { RecurringTransaction } from '../src/recurring/domain/recurring-transaction.entity';

// Requêtes envoyées par le front (voir frontend/src/shared/api/api-contract.test.tsx).
describe('Front/back contract (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mocks.accounts.save.mockResolvedValue(undefined);
    mocks.accounts.findById.mockResolvedValue(
      new Account({
        id: '00000000-0000-4000-8000-000000000101',
        name: 'Courant',
        ownerId: USER.id,
        initialBalance: BigInt(0),
      }),
    );
    mocks.tags.save.mockResolvedValue(undefined);
    mocks.transactions.sumAmountByAccountBeforeDate.mockResolvedValue(
      BigInt(0),
    );
    mocks.recurring.findAllByAccount.mockResolvedValue([]);
  });

  describe('account creation', () => {
    it('creates an account owned by the authenticated user', async () => {
      const res = await http()
        .post('/accounts')
        .set(auth())
        .send({ name: 'Courant', initialBalance: '150000' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Courant',
        ownerId: USER.id,
        initialBalance: '150000',
      });
    });

    // Le front n'envoie plus type ni currency : ces colonnes n'existent pas.
    it('still rejects type and currency (unknown fields)', async () => {
      await http()
        .post('/accounts')
        .set(auth())
        .send({ name: 'Courant', type: 'checking', currency: 'EUR' })
        .expect(400);

      expect(mocks.accounts.save).not.toHaveBeenCalled();
    });

    it('accepts the payload sent by the front (name, description, initialBalance)', () =>
      http()
        .post('/accounts')
        .set(auth())
        .send({ name: 'Courant', description: 'Perso', initialBalance: '0' })
        .expect(201));
  });

  describe('tag creation', () => {
    it('creates a tag with a hex color', () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/tags')
        .set(auth())
        .send({ name: 'Vacances', color: '#22c55e' })
        .expect(201));

    // Le tag-selector du front crée un tag à la volée sans couleur.
    it('creates a tag without color with the default color', async () => {
      const res = await http()
        .post('/00000000-0000-4000-8000-000000000101/tags')
        .set(auth())
        .send({ name: 'Vacances' })
        .expect(201);

      expect((res.body as { color: string }).color).toBe('#94a3b8');
      expect(mocks.tags.save).toHaveBeenCalledTimes(1);
    });

    it('still rejects a color that is not hexadecimal', () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/tags')
        .set(auth())
        .send({ name: 'Vacances', color: 'green' })
        .expect(400));
  });

  describe('cashflow forecast', () => {
    // Un récurrent dont la prochaine occurrence tombe dans ~60 jours.
    const inSixtyDays = () => {
      const d = new Date();
      d.setDate(d.getDate() + 60);
      mocks.recurring.findAllByAccount.mockResolvedValue([
        RecurringTransaction.create({
          accountId: '00000000-0000-4000-8000-000000000101',
          categoryId: null,
          description: 'Assurance',
          amount: BigInt(-1000),
          dayOfMonth: Math.min(d.getDate(), 28),
        }),
      ]);
    };

    it('answers to the GET sent by the front', async () => {
      const res = await http()
        .get('/00000000-0000-4000-8000-000000000101/reporting/cashflow')
        .query({ days: '30' })
        .set(auth())
        .expect(200);

      expect(res.body).toEqual({ currentBalance: '0', events: [] });
    });

    it('converts days to a number (a 10-day horizon hides a 60-day event)', async () => {
      inSixtyDays();
      const res = await http()
        .get('/00000000-0000-4000-8000-000000000101/reporting/cashflow')
        .query({ days: '10' })
        .set(auth())
        .expect(200);

      expect((res.body as { events: unknown[] }).events).toHaveLength(0);
    });

    it('defaults to 90 days without the days parameter', async () => {
      inSixtyDays();
      const res = await http()
        .get('/00000000-0000-4000-8000-000000000101/reporting/cashflow')
        .set(auth())
        .expect(200);

      expect((res.body as { events: unknown[] }).events.length).toBeGreaterThan(
        0,
      );
    });

    it.each(['abc', '0', '-5', '1000', '1.5'])(
      'answers 400 for days=%s',
      async (days) => {
        await http()
          .get('/00000000-0000-4000-8000-000000000101/reporting/cashflow')
          .query({ days })
          .set(auth())
          .expect(400);
        expect(mocks.recurring.findAllByAccount).not.toHaveBeenCalled();
      },
    );

    it.each(['1', '365'])('accepts days=%s', (days) =>
      http()
        .get('/00000000-0000-4000-8000-000000000101/reporting/cashflow')
        .query({ days })
        .set(auth())
        .expect(200),
    );

    it('is no longer exposed as POST', () =>
      http()
        .post('/00000000-0000-4000-8000-000000000101/reporting/cashflow')
        .set(auth())
        .expect(404));
  });

  describe('removed AI routes', () => {
    it.each([
      [
        'get',
        'periods/00000000-0000-4000-8000-000000000107/reporting/ai-insights',
      ],
      ['get', 'reporting/evolution/ai-insights'],
      ['post', 'reporting/scan-receipt'],
    ] as const)('%s %s answers 404', (method, path) =>
      http()
        [method](`/00000000-0000-4000-8000-000000000101/${path}`)
        .set(auth())
        .send({ base64Image: 'AAAA', mimeType: 'image/jpeg' })
        .expect(404),
    );
  });
});
