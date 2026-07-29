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
    const originalGoogleClientSecret = config.GOOGLE_CLIENT_SECRET;

    beforeEach(function () {
      config.GOOGLE_CLIENT_ID = 'test-google-client-id';
      config.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    });

    afterEach(function () {
      config.GOOGLE_CLIENT_ID = originalGoogleClientId;
      config.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
      sinon.restore();
    });

    function stubGoogle(payload: TokenPayload) {
      sinon
        .stub(OAuth2Client.prototype, 'getToken')
        .resolves({ tokens: { id_token: 'fake-id-token' } } as never);
      sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves(mockTicket(payload));
    }

    function basePayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
      return {
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
        ...overrides,
      };
    }

    it('creates a new user from an auth code and stores googleId', async function () {
      stubGoogle(basePayload());

      const res = await request(app).post('/v1/auth/google').send({ code: 'auth-code' });

      assert.equal(res.status, 200);
      assert.exists(res.body.token);
      assert.equal(res.body.user.email, 'google@example.com');
      assert.equal(res.body.user.firstName, 'Google');

      const user = await User.findOne({ where: { email: 'google@example.com' } });
      assert.equal(user?.googleId, 'google-user-id-123');
    });

    it('matches an existing user by googleId (sub)', async function () {
      await User.create({
        email: 'old@example.com',
        firstName: 'Old',
        googleId: 'google-user-id-123',
      });

      stubGoogle(basePayload({ email: 'new-address@example.com' }));

      const res = await request(app).post('/v1/auth/google').send({ code: 'auth-code' });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'old@example.com');
      const count = await User.count();
      assert.equal(count, 1);
    });

    it('backfills googleId on an existing email-matched user', async function () {
      await User.create({ email: 'google@example.com', firstName: 'Existing' });

      stubGoogle(basePayload());

      const res = await request(app).post('/v1/auth/google').send({ code: 'auth-code' });

      assert.equal(res.status, 200);
      const user = await User.findOne({ where: { email: 'google@example.com' } });
      assert.equal(user?.googleId, 'google-user-id-123');
      const count = await User.count();
      assert.equal(count, 1);
    });

    it('returns 401 when the email is not verified', async function () {
      stubGoogle(basePayload({ email_verified: false }));

      const res = await request(app).post('/v1/auth/google').send({ code: 'auth-code' });

      assert.equal(res.status, 401);
    });

    it('returns 401 when the code exchange fails', async function () {
      sinon.stub(OAuth2Client.prototype, 'getToken').rejects(new Error('invalid_grant'));

      const res = await request(app).post('/v1/auth/google').send({ code: 'bad-code' });

      assert.equal(res.status, 401);
    });

    it('returns 400 if GOOGLE_CLIENT_ID is not set', async function () {
      config.GOOGLE_CLIENT_ID = undefined;

      const res = await request(app).post('/v1/auth/google').send({ code: 'auth-code' });

      assert.equal(res.status, 400);
    });

    it('returns 400 if code is missing', async function () {
      const res = await request(app).post('/v1/auth/google').send({});

      assert.equal(res.status, 400);
    });
  });
});
