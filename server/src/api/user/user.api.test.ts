import { assert } from 'chai';
import request from 'supertest';
import app from '../../server';
import { createUser, createUserWithToken } from '../../test/testDataGenerator';

describe('User API', function () {
  describe('GET /v1/users/me', function () {
    it('returns the authenticated user', async function () {
      const { user, token } = await createUserWithToken({ firstName: 'Me' });

      const res = await request(app)
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.equal(res.body.user.id, user.id);
      assert.equal(res.body.user.firstName, 'Me');
    });

    it('returns 401 without authentication', async function () {
      await request(app).get('/v1/users/me').expect(401);
    });
  });

  describe('GET /v1/users/:userId', function () {
    it('allows a user to get their own profile', async function () {
      const { user, token } = await createUserWithToken({ firstName: 'Self' });

      const res = await request(app)
        .get(`/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.equal(res.body.user.id, user.id);
      assert.equal(res.body.user.firstName, 'Self');
    });

    it('allows an admin to get any user', async function () {
      const { token: adminToken } = await createUserWithToken({ role: 'admin' });
      const targetUser = await createUser({ firstName: 'Target' });

      const res = await request(app)
        .get(`/v1/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.user.id, targetUser.id);
      assert.equal(res.body.user.firstName, 'Target');
    });

    it('returns 403 when a non-admin tries to get another user', async function () {
      const { token } = await createUserWithToken();
      const otherUser = await createUser();

      await request(app)
        .get(`/v1/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns 404 for non-existent user', async function () {
      const { token } = await createUserWithToken({ role: 'admin' });

      await request(app)
        .get('/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 400 for invalid UUID', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .get('/v1/users/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 401 without authentication', async function () {
      await request(app).get('/v1/users/00000000-0000-0000-0000-000000000000').expect(401);
    });
  });

  describe('PUT /v1/users/:userId', function () {
    it('allows a user to update their own profile', async function () {
      const { user, token } = await createUserWithToken({ firstName: 'Old' });

      const res = await request(app)
        .put(`/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'New' })
        .expect(200);

      assert.equal(res.body.user.firstName, 'New');
    });

    it('allows an admin to update any user', async function () {
      const { token: adminToken } = await createUserWithToken({ role: 'admin' });
      const targetUser = await createUser({ firstName: 'Before' });

      const res = await request(app)
        .put(`/v1/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'After' })
        .expect(200);

      assert.equal(res.body.user.firstName, 'After');
    });

    it('returns 403 when a non-admin tries to update another user', async function () {
      const { token } = await createUserWithToken();
      const otherUser = await createUser();

      await request(app)
        .put(`/v1/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Hacked' })
        .expect(403);
    });

    it('returns 400 when no updatable fields are provided', async function () {
      const { user, token } = await createUserWithToken();

      await request(app)
        .put(`/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid UUID', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .put('/v1/users/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Test' })
        .expect(400);
    });

    it('returns 404 for non-existent user', async function () {
      const { token } = await createUserWithToken({ role: 'admin' });

      await request(app)
        .put('/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Ghost' })
        .expect(404);
    });

    it('returns 401 without authentication', async function () {
      await request(app)
        .put('/v1/users/00000000-0000-0000-0000-000000000000')
        .send({ firstName: 'Test' })
        .expect(401);
    });
  });
});
