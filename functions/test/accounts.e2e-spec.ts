import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks, USER } from './e2e-app';
import { Account } from '../src/accounts/domain/account.entity';
import { AccountShare } from '../src/accounts/domain/account-share.entity';

const ENTITY_KEYS = [
  'createdAt',
  'id',
  'initialBalance',
  'name',
  'ownerId',
  'updatedAt',
];

describe('Accounts and sharing routes (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const http = () => request(app.getHttpServer());

  const account = (ownerId = USER.id) =>
    new Account({
      id: '00000000-0000-4000-8000-000000000101',
      name: 'Courant',
      ownerId,
      initialBalance: BigInt(150000),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mocks.accounts.findById.mockResolvedValue(account());
    mocks.accounts.save.mockResolvedValue(undefined);
    mocks.shares.save.mockResolvedValue(undefined);
    mocks.shares.delete.mockResolvedValue(undefined);
    mocks.users.findByEmail.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000105',
      email: 'guest@example.com',
    });
  });

  it('GET /accounts lists the accessible accounts with string balances', async () => {
    mocks.accounts.findAllForUser.mockResolvedValue([account()]);

    const res = await http().get('/accounts').set(auth()).expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000101',
        ownerId: USER.id,
        initialBalance: '150000',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ]);
  });

  it('PATCH /accounts/:id updates the initial balance and keeps the owner', async () => {
    const res = await http()
      .patch('/accounts/00000000-0000-4000-8000-000000000101')
      .set(auth())
      .send({ initialBalance: '-2500' })
      .expect(200);

    expect(res.body).toMatchObject({
      ownerId: USER.id,
      initialBalance: '-2500',
    });
  });

  describe('legacy `description` sent by a cached front', () => {
    it('POST /accounts succeeds and neither stores nor returns description', async () => {
      const res = await http()
        .post('/accounts')
        .set(auth())
        .send({ name: 'Courant', description: 'Perso', initialBalance: '0' })
        .expect(201);

      expect(res.body).not.toHaveProperty('description');
      const [[saved]] = mocks.accounts.save.mock.calls as [Account][];
      expect(Object.keys(saved).sort()).toEqual(ENTITY_KEYS);
      expect(saved.name).toBe('Courant');
    });

    it('PATCH /accounts/:id updates the other fields and ignores description', async () => {
      const res = await http()
        .patch('/accounts/00000000-0000-4000-8000-000000000101')
        .set(auth())
        .send({ name: 'Renommé', description: 'Perso' })
        .expect(200);

      expect(res.body).toMatchObject({ name: 'Renommé' });
      expect(res.body).not.toHaveProperty('description');
      const [[saved]] = mocks.accounts.save.mock.calls as [Account][];
      expect(Object.keys(saved).sort()).toEqual(ENTITY_KEYS);
      expect(saved.name).toBe('Renommé');
    });

    it('PATCH /accounts/:id with only description succeeds and changes nothing', async () => {
      const res = await http()
        .patch('/accounts/00000000-0000-4000-8000-000000000101')
        .set(auth())
        .send({ description: 'Perso' })
        .expect(200);

      expect(res.body).toMatchObject({
        name: 'Courant',
        initialBalance: '150000',
      });
      expect(res.body).not.toHaveProperty('description');
    });

    it('GET /accounts never returns description', async () => {
      mocks.accounts.findAllForUser.mockResolvedValue([account()]);
      const res = await http().get('/accounts').set(auth()).expect(200);
      expect((res.body as unknown[])[0]).not.toHaveProperty('description');
    });

    it('PATCH /accounts/:id still rejects other unknown fields (400)', async () => {
      await http()
        .patch('/accounts/00000000-0000-4000-8000-000000000101')
        .set(auth())
        .send({ name: 'X', type: 'checking' })
        .expect(400);
      expect(mocks.accounts.save).not.toHaveBeenCalled();
    });

    it('PATCH /accounts/:id answers 404 to a user with no access at all (RLS hides the account), nothing written', async () => {
      mocks.accounts.findById.mockResolvedValue(null);
      await http()
        .patch('/accounts/00000000-0000-4000-8000-000000000101')
        .set(auth())
        .send({ name: 'X', description: 'Perso' })
        .expect(404);
      expect(mocks.accounts.save).not.toHaveBeenCalled();
    });

    it('PATCH /accounts/:id answers 403 to a non-owner, with or without description', async () => {
      mocks.accounts.findById.mockResolvedValue(
        account('00000000-0000-4000-8000-000000000104'),
      );
      await http()
        .patch('/accounts/00000000-0000-4000-8000-000000000101')
        .set(auth())
        .send({ name: 'X' })
        .expect(403);
      await http()
        .patch('/accounts/00000000-0000-4000-8000-000000000101')
        .set(auth())
        .send({ name: 'X', description: 'Perso' })
        .expect(403);
      expect(mocks.accounts.save).not.toHaveBeenCalled();
    });
  });

  describe('POST /accounts/:id/shares', () => {
    it('shares the account on behalf of the authenticated user', async () => {
      await http()
        .post('/accounts/00000000-0000-4000-8000-000000000101/shares')
        .set(auth())
        .send({ email: 'guest@example.com', permission: 'write' })
        .expect(201, { success: true });

      const [[share]] = mocks.shares.save.mock.calls as [AccountShare][];
      expect(share).toMatchObject({
        accountId: '00000000-0000-4000-8000-000000000101',
        userId: '00000000-0000-4000-8000-000000000105',
        permission: 'write',
      });
    });

    it('answers 403 when the authenticated user is not the owner', async () => {
      mocks.accounts.findById.mockResolvedValue(
        account('00000000-0000-4000-8000-000000000104'),
      );

      await http()
        .post('/accounts/00000000-0000-4000-8000-000000000101/shares')
        .set(auth())
        .send({ email: 'guest@example.com', permission: 'read' })
        .expect(403, {
          statusCode: 403,
          message: 'Only the account owner can manage shares',
          error: 'Forbidden',
        });
      expect(mocks.shares.save).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown account', async () => {
      mocks.accounts.findById.mockResolvedValue(null);

      await http()
        .post('/accounts/00000000-0000-4000-8000-000000000199/shares')
        .set(auth())
        .send({ email: 'guest@example.com', permission: 'read' })
        .expect(404);
      expect(mocks.shares.save).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown email', async () => {
      mocks.users.findByEmail.mockResolvedValue(null);

      await http()
        .post('/accounts/00000000-0000-4000-8000-000000000101/shares')
        .set(auth())
        .send({ email: 'ghost@example.com', permission: 'read' })
        .expect(404);
      expect(mocks.shares.save).not.toHaveBeenCalled();
    });

    it('answers 400 when sharing with oneself', async () => {
      mocks.users.findByEmail.mockResolvedValue({
        id: USER.id,
        email: USER.email,
      });

      await http()
        .post('/accounts/00000000-0000-4000-8000-000000000101/shares')
        .set(auth())
        .send({ email: USER.email, permission: 'read' })
        .expect(400);
      expect(mocks.shares.save).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /accounts/:id/shares/:userId', () => {
    it('removes the share when the authenticated user is the owner', async () => {
      await http()
        .delete(
          '/accounts/00000000-0000-4000-8000-000000000101/shares/00000000-0000-4000-8000-000000000105',
        )
        .set(auth())
        .expect(200, { success: true });

      expect(mocks.shares.delete).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000101',
        '00000000-0000-4000-8000-000000000105',
      );
    });

    it('refuses (403) when the authenticated user is not the owner', async () => {
      mocks.accounts.findById.mockResolvedValue(
        account('00000000-0000-4000-8000-000000000104'),
      );

      await http()
        .delete(
          '/accounts/00000000-0000-4000-8000-000000000101/shares/00000000-0000-4000-8000-000000000105',
        )
        .set(auth())
        .expect(403);
      expect(mocks.shares.delete).not.toHaveBeenCalled();
    });
  });

  describe('GET /accounts/:id/shares', () => {
    it('lists the shares for the owner', async () => {
      mocks.shares.findAllByAccount.mockResolvedValue([]);

      await http()
        .get('/accounts/00000000-0000-4000-8000-000000000101/shares')
        .set(auth())
        .expect(200, []);
    });

    it('refuses (403) when the authenticated user is not the owner', async () => {
      mocks.accounts.findById.mockResolvedValue(
        account('00000000-0000-4000-8000-000000000104'),
      );

      await http()
        .get('/accounts/00000000-0000-4000-8000-000000000101/shares')
        .set(auth())
        .expect(403);
      expect(mocks.shares.findAllByAccount).not.toHaveBeenCalled();
    });
  });
});
