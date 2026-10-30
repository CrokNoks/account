import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks, USER } from './e2e-app';
import { Account } from '../src/accounts/domain/account.entity';
import { AccountShare } from '../src/accounts/domain/account-share.entity';

describe('Accounts and sharing routes (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  const http = () => request(app.getHttpServer());

  const account = (ownerId = USER.id) =>
    new Account({
      id: 'acc-1',
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
      id: 'guest-1',
      email: 'guest@example.com',
    });
  });

  it('GET /accounts lists the accessible accounts with string balances', async () => {
    mocks.accounts.findAllForUser.mockResolvedValue([account()]);

    const res = await http().get('/accounts').set(auth()).expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({
        id: 'acc-1',
        ownerId: USER.id,
        initialBalance: '150000',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ]);
  });

  it('PATCH /accounts/:id updates the initial balance and keeps the owner', async () => {
    const res = await http()
      .patch('/accounts/acc-1')
      .set(auth())
      .send({ initialBalance: '-2500' })
      .expect(200);

    expect(res.body).toMatchObject({
      ownerId: USER.id,
      initialBalance: '-2500',
    });
  });

  describe('POST /accounts/:id/shares', () => {
    it('shares the account on behalf of the authenticated user', async () => {
      await http()
        .post('/accounts/acc-1/shares')
        .set(auth())
        .send({ email: 'guest@example.com', permission: 'write' })
        .expect(201, { success: true });

      const [[share]] = mocks.shares.save.mock.calls as [AccountShare][];
      expect(share).toMatchObject({
        accountId: 'acc-1',
        userId: 'guest-1',
        permission: 'write',
      });
    });

    it('answers 403 when the authenticated user is not the owner', async () => {
      mocks.accounts.findById.mockResolvedValue(account('someone-else'));

      await http()
        .post('/accounts/acc-1/shares')
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
        .post('/accounts/nope/shares')
        .set(auth())
        .send({ email: 'guest@example.com', permission: 'read' })
        .expect(404);
      expect(mocks.shares.save).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown email', async () => {
      mocks.users.findByEmail.mockResolvedValue(null);

      await http()
        .post('/accounts/acc-1/shares')
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
        .post('/accounts/acc-1/shares')
        .set(auth())
        .send({ email: USER.email, permission: 'read' })
        .expect(400);
      expect(mocks.shares.save).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /accounts/:id/shares/:userId', () => {
    it('removes the share when the authenticated user is the owner', async () => {
      await http()
        .delete('/accounts/acc-1/shares/guest-1')
        .set(auth())
        .expect(200, { success: true });

      expect(mocks.shares.delete).toHaveBeenCalledWith('acc-1', 'guest-1');
    });

    it('refuses (403) when the authenticated user is not the owner', async () => {
      mocks.accounts.findById.mockResolvedValue(account('someone-else'));

      await http()
        .delete('/accounts/acc-1/shares/guest-1')
        .set(auth())
        .expect(403);
      expect(mocks.shares.delete).not.toHaveBeenCalled();
    });
  });

  describe('GET /accounts/:id/shares', () => {
    it('lists the shares for the owner', async () => {
      mocks.shares.findAllByAccount.mockResolvedValue([]);

      await http().get('/accounts/acc-1/shares').set(auth()).expect(200, []);
    });

    it('refuses (403) when the authenticated user is not the owner', async () => {
      mocks.accounts.findById.mockResolvedValue(account('someone-else'));

      await http().get('/accounts/acc-1/shares').set(auth()).expect(403);
      expect(mocks.shares.findAllByAccount).not.toHaveBeenCalled();
    });
  });
});
