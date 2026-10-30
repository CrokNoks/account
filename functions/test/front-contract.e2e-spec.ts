import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks, USER } from './e2e-app';
import { Account } from '../src/accounts/domain/account.entity';

// Écarts front/back relevés par les documentalistes : ces tests reproduisent
// les requêtes envoyées aujourd'hui par le front et figent la réponse actuelle.
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
        id: 'acc-1',
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

    // frontend/src/features/accounts/api/use-create-account.ts envoie type et currency.
    it('rejects the payload sent by the front (type and currency are unknown)', async () => {
      await http()
        .post('/accounts')
        .set(auth())
        .send({ name: 'Courant', type: 'checking', currency: 'EUR' })
        .expect(400);

      expect(mocks.accounts.save).not.toHaveBeenCalled();
    });
  });

  describe('tag creation', () => {
    it('creates a tag with a hex color', () =>
      http()
        .post('/acc-1/tags')
        .set(auth())
        .send({ name: 'Vacances', color: '#22c55e' })
        .expect(201));

    // Le tag-selector du front crée un tag à la volée sans couleur.
    it('rejects a tag without color', async () => {
      await http()
        .post('/acc-1/tags')
        .set(auth())
        .send({ name: 'Vacances' })
        .expect(400);

      expect(mocks.tags.save).not.toHaveBeenCalled();
    });
  });

  describe('cashflow forecast', () => {
    it('is exposed as POST', async () => {
      const res = await http()
        .post('/acc-1/reporting/cashflow')
        .query({ days: '30' })
        .set(auth())
        .expect(201);

      expect(res.body).toEqual({ currentBalance: '0', events: [] });
    });

    // frontend/src/features/reporting/api/use-cashflow-forecast.ts appelle en GET.
    it('answers 404 to the GET sent by the front', () =>
      http().get('/acc-1/reporting/cashflow').set(auth()).expect(404));
  });

  describe('receipt scan', () => {
    it('accepts the payload sent by the front and returns empty fields when the AI is not configured', async () => {
      mocks.gemini.analyzeImage.mockRejectedValue(new Error('no key'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await http()
        .post('/acc-1/reporting/scan-receipt')
        .set(auth())
        .send({ base64Image: 'AAAA', mimeType: 'image/jpeg' })
        .expect(201);

      expect(res.body).toEqual({
        date: null,
        amount: null,
        description: null,
        type: null,
      });
    });

    it.each([
      ['an unknown body', { anything: true }],
      ['an empty image', { base64Image: '', mimeType: 'image/jpeg' }],
      ['an unsupported mime type', { base64Image: 'AAAA', mimeType: 'text/x' }],
      ['a missing mime type', { base64Image: 'AAAA' }],
    ])('answers 400 without calling the AI for %s', async (_, payload) => {
      await http()
        .post('/acc-1/reporting/scan-receipt')
        .set(auth())
        .send(payload)
        .expect(400);
      expect(mocks.gemini.analyzeImage).not.toHaveBeenCalled();
    });
  });
});
