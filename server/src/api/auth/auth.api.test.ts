import { assert } from 'chai';
import * as sinon from 'sinon';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { LoginTicket, OAuth2Client, TokenPayload } from 'google-auth-library';
import app from '../../server';
import User from '../../db/models/user.model';
import config from '../../config/config';

function mockTicket(payload: TokenPayload): LoginTicket {
  const ticket = new LoginTicket();
  sinon.stub(ticket, 'getPayload').returns(payload);
  return ticket;
}

describe('Auth API', function () {
  describe('POST /v1/auth/signup', function () {
    it('creates a new user and returns a token', function (done) {
      request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201)
        .end(function (err, res) {
          if (err) return done(err);
          assert.exists(res.body.token);
          assert.equal(res.body.user.email, 'test@example.com');
          assert.equal(res.body.user.firstName, 'Test');
          assert.equal(res.body.user.lastName, 'User');
          assert.equal(res.body.user.role, 'user');
          assert.exists(res.body.user.id);
          done();
        });
    });

    it('hashes the password', async function () {
      await request(app).post('/v1/auth/signup').send({
        email: 'hash@example.com',
        password: 'password123',
        firstName: 'Hash',
      });

      const user = await User.findOne({ where: { email: 'hash@example.com' } });
      assert.exists(user?.passwordHash);
      assert.notEqual(user!.passwordHash, 'password123');
      const matches = await bcrypt.compare('password123', user!.passwordHash!);
      assert.isTrue(matches);
    });

    it('returns 409 if email already exists', async function () {
      await request(app).post('/v1/auth/signup').send({
        email: 'dupe@example.com',
        password: 'password123',
        firstName: 'First',
      });

      const res = await request(app).post('/v1/auth/signup').send({
        email: 'dupe@example.com',
        password: 'password456',
        firstName: 'Second',
      });

      assert.equal(res.status, 409);
    });

    it('returns 400 if required fields are missing', async function () {
      const res = await request(app).post('/v1/auth/signup').send({ email: 'test@example.com' });

      assert.equal(res.status, 400);
    });
  });

  describe('POST /v1/auth/login', function () {
    beforeEach(async function () {
      const passwordHash = await bcrypt.hash('password123', 10);
      await User.create({
        email: 'login@example.com',
        firstName: 'Login',
        lastName: 'User',
        passwordHash,
      });
    });

    it('logs in with correct credentials', function (done) {
      request(app)
        .post('/v1/auth/login')
        .send({ email: 'login@example.com', password: 'password123' })
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          assert.exists(res.body.token);
          assert.equal(res.body.user.email, 'login@example.com');
          assert.equal(res.body.user.firstName, 'Login');
          done();
        });
    });

    it('returns 401 for wrong password', async function () {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'login@example.com', password: 'wrongpassword' });

      assert.equal(res.status, 401);
    });

    it('returns 401 for non-existent email', async function () {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

      assert.equal(res.status, 401);
    });

    it('returns 400 if required fields are missing', async function () {
      const res = await request(app).post('/v1/auth/login').send({ email: 'login@example.com' });

      assert.equal(res.status, 400);
    });
  });

  describe('POST /v1/auth/google', function () {
    const originalGoogleClientId = config.GOOGLE_CLIENT_ID;

    beforeEach(function () {
      config.GOOGLE_CLIENT_ID = 'test-google-client-id';
    });

    afterEach(function () {
      config.GOOGLE_CLIENT_ID = originalGoogleClientId;
      sinon.restore();
    });

    it('creates a new user from Google token', async function () {
      sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves(
        mockTicket({
          email: 'google@example.com',
          email_verified: true,
          given_name: 'Google',
          family_name: 'User',
          picture: 'https://example.com/photo.jpg',
          sub: 'google-user-id-123',
          aud: 'test-google-client-id',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          iss: 'accounts.google.com',
        }),
      );

      const res = await request(app)
        .post('/v1/auth/google')
        .send({ idToken: 'valid-google-token' });

      assert.equal(res.status, 200);
      assert.exists(res.body.token);
      assert.equal(res.body.user.email, 'google@example.com');
      assert.equal(res.body.user.firstName, 'Google');
      assert.equal(res.body.user.lastName, 'User');
    });

    it('logs in existing user with matching email', async function () {
      await User.create({
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
      });

      sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves(
        mockTicket({
          email: 'existing@example.com',
          email_verified: true,
          given_name: 'Existing',
          family_name: 'User',
          sub: 'google-user-id-456',
          aud: 'test-google-client-id',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          iss: 'accounts.google.com',
        }),
      );

      const res = await request(app)
        .post('/v1/auth/google')
        .send({ idToken: 'valid-google-token' });

      assert.equal(res.status, 200);
      assert.exists(res.body.token);
      assert.equal(res.body.user.email, 'existing@example.com');

      const users = await User.findAll({
        where: { email: 'existing@example.com' },
      });
      assert.equal(users.length, 1);
    });

    it('returns 400 if GOOGLE_CLIENT_ID is not set', async function () {
      config.GOOGLE_CLIENT_ID = undefined;

      const res = await request(app).post('/v1/auth/google').send({ idToken: 'some-token' });

      assert.equal(res.status, 400);
    });

    it('returns 401 for invalid token', async function () {
      sinon.stub(OAuth2Client.prototype, 'verifyIdToken').rejects(new Error('Invalid token'));

      const res = await request(app).post('/v1/auth/google').send({ idToken: 'invalid-token' });

      assert.equal(res.status, 401);
    });

    it('returns 400 if idToken is missing', async function () {
      const res = await request(app).post('/v1/auth/google').send({});

      assert.equal(res.status, 400);
    });
  });
});
