import { assert } from 'chai';
import * as sinon from 'sinon';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { LoginTicket, OAuth2Client, TokenPayload } from 'google-auth-library';
import * as appleSignIn from 'apple-signin-auth';
import { UniqueConstraintError } from 'sequelize';
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
    const originalGoogleIosClientId = config.GOOGLE_IOS_CLIENT_ID;

    beforeEach(function () {
      config.GOOGLE_CLIENT_ID = 'test-google-client-id';
      config.GOOGLE_IOS_CLIENT_ID = undefined;
    });

    afterEach(function () {
      config.GOOGLE_CLIENT_ID = originalGoogleClientId;
      config.GOOGLE_IOS_CLIENT_ID = originalGoogleIosClientId;
      sinon.restore();
    });

    function stubGoogle(payload: TokenPayload) {
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

    it('creates a new user from an ID token and stores googleId', async function () {
      stubGoogle(basePayload());

      const res = await request(app).post('/v1/auth/google').send({ idToken: 'valid-id-token' });

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

      const res = await request(app).post('/v1/auth/google').send({ idToken: 'valid-id-token' });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'old@example.com');
      const count = await User.count();
      assert.equal(count, 1);
    });

    it('backfills googleId on an existing email-matched user', async function () {
      await User.create({ email: 'google@example.com', firstName: 'Existing' });

      stubGoogle(basePayload());

      const res = await request(app).post('/v1/auth/google').send({ idToken: 'valid-id-token' });

      assert.equal(res.status, 200);
      const user = await User.findOne({ where: { email: 'google@example.com' } });
      assert.equal(user?.googleId, 'google-user-id-123');
      const count = await User.count();
      assert.equal(count, 1);
    });

    it('links googleId when recovering from a create race', async function () {
      // A concurrent password signup wins the create race: the Google create
      // hits a unique-constraint error, and the recovery re-fetch finds an
      // email-only row that must still be linked to the Google sub.
      const raced = await User.create({ email: 'race@example.com', firstName: 'Race' });

      const findOne = sinon.stub(User, 'findOne');
      findOne.onCall(0).resolves(null); // by googleId, pre-create
      findOne.onCall(1).resolves(null); // by email, pre-create
      findOne.onCall(2).resolves(null); // recovery by googleId
      findOne.onCall(3).resolves(raced); // recovery by email
      sinon.stub(User, 'create').rejects(new UniqueConstraintError({}));

      stubGoogle(basePayload({ email: 'race@example.com', sub: 'race-sub' }));

      const res = await request(app).post('/v1/auth/google').send({ idToken: 'valid-id-token' });

      assert.equal(res.status, 200);
      findOne.restore();
      await raced.reload();
      assert.equal(raced.googleId, 'race-sub');
    });

    it('rejects when the email is already linked to a different Google account', async function () {
      await User.create({
        email: 'taken@example.com',
        firstName: 'Taken',
        googleId: 'sub-existing',
      });

      stubGoogle(basePayload({ email: 'taken@example.com', sub: 'sub-different' }));

      const res = await request(app).post('/v1/auth/google').send({ idToken: 'valid-id-token' });

      assert.equal(res.status, 401);
      const user = await User.findOne({ where: { email: 'taken@example.com' } });
      assert.equal(user?.googleId, 'sub-existing');
    });

    it('returns 401 when the email is not verified', async function () {
      stubGoogle(basePayload({ email_verified: false }));

      const res = await request(app).post('/v1/auth/google').send({ idToken: 'valid-id-token' });

      assert.equal(res.status, 401);
    });

    it('returns 401 when ID token verification fails', async function () {
      sinon.stub(OAuth2Client.prototype, 'verifyIdToken').rejects(new Error('invalid token'));

      const res = await request(app).post('/v1/auth/google').send({ idToken: 'bad-id-token' });

      assert.equal(res.status, 401);
    });

    it('returns 400 if GOOGLE_CLIENT_ID is not set', async function () {
      config.GOOGLE_CLIENT_ID = undefined;

      const res = await request(app).post('/v1/auth/google').send({ idToken: 'valid-id-token' });

      assert.equal(res.status, 400);
    });

    it('returns 400 if idToken is missing', async function () {
      const res = await request(app).post('/v1/auth/google').send({});

      assert.equal(res.status, 400);
    });
  });

  describe('POST /v1/auth/apple', function () {
    const originalAppleClientId = config.APPLE_CLIENT_ID;

    beforeEach(function () {
      config.APPLE_CLIENT_ID = 'fm.lengua.app';
    });

    afterEach(function () {
      config.APPLE_CLIENT_ID = originalAppleClientId;
      sinon.restore();
    });

    type AppleIdTokenType = Awaited<ReturnType<typeof appleSignIn.verifyIdToken>>;

    function applePayload(overrides: Partial<AppleIdTokenType> = {}): AppleIdTokenType {
      return {
        iss: 'https://appleid.apple.com',
        aud: 'fm.lengua.app',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        sub: 'apple-user-id-123',
        email: 'apple@example.com',
        email_verified: true,
        ...overrides,
      } as AppleIdTokenType;
    }

    function stubApple(payload: AppleIdTokenType) {
      sinon.stub(appleSignIn, 'verifyIdToken').resolves(payload);
    }

    it('creates a new user from an identity token and stores appleId', async function () {
      stubApple(applePayload());

      const res = await request(app)
        .post('/v1/auth/apple')
        .send({ identityToken: 'valid-id-token', firstName: 'Apple', lastName: 'User' });

      assert.equal(res.status, 200);
      assert.exists(res.body.token);
      assert.equal(res.body.user.email, 'apple@example.com');
      assert.equal(res.body.user.firstName, 'Apple');
      assert.equal(res.body.user.lastName, 'User');

      const user = await User.findOne({ where: { email: 'apple@example.com' } });
      assert.equal(user?.appleId, 'apple-user-id-123');
      assert.equal(user?.verifiedEmail, 'apple@example.com');
    });

    it('falls back to the email localpart when no name is supplied', async function () {
      stubApple(applePayload());

      const res = await request(app)
        .post('/v1/auth/apple')
        .send({ identityToken: 'valid-id-token' });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.firstName, 'apple');
      assert.equal(res.body.user.lastName, '');
    });

    it('uses a placeholder email when the token omits one', async function () {
      stubApple(applePayload({ email: undefined }));

      const res = await request(app)
        .post('/v1/auth/apple')
        .send({ identityToken: 'valid-id-token', firstName: 'Apple' });

      assert.equal(res.status, 200);
      const user = await User.findOne({ where: { appleId: 'apple-user-id-123' } });
      assert.equal(user?.email, 'apple-apple-user-id-123@lengua.placeholder');
    });

    it('matches an existing user by appleId (sub)', async function () {
      await User.create({
        email: 'old@example.com',
        firstName: 'Old',
        appleId: 'apple-user-id-123',
      });

      stubApple(applePayload({ email: 'new-address@example.com' }));

      const res = await request(app)
        .post('/v1/auth/apple')
        .send({ identityToken: 'valid-id-token' });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'old@example.com');
      const count = await User.count();
      assert.equal(count, 1);
    });

    it('backfills appleId on an existing email-matched user', async function () {
      await User.create({ email: 'apple@example.com', firstName: 'Existing' });

      stubApple(applePayload());

      const res = await request(app)
        .post('/v1/auth/apple')
        .send({ identityToken: 'valid-id-token' });

      assert.equal(res.status, 200);
      const user = await User.findOne({ where: { email: 'apple@example.com' } });
      assert.equal(user?.appleId, 'apple-user-id-123');
      const count = await User.count();
      assert.equal(count, 1);
    });

    it('links appleId when recovering from a create race', async function () {
      const raced = await User.create({ email: 'race@example.com', firstName: 'Race' });

      const findOne = sinon.stub(User, 'findOne');
      findOne.onCall(0).resolves(null); // by appleId, pre-create
      findOne.onCall(1).resolves(null); // by email, pre-create
      findOne.onCall(2).resolves(null); // recovery by appleId
      findOne.onCall(3).resolves(raced); // recovery by email
      sinon.stub(User, 'create').rejects(new UniqueConstraintError({}));

      stubApple(applePayload({ email: 'race@example.com', sub: 'race-sub' }));

      const res = await request(app)
        .post('/v1/auth/apple')
        .send({ identityToken: 'valid-id-token' });

      assert.equal(res.status, 200);
      findOne.restore();
      await raced.reload();
      assert.equal(raced.appleId, 'race-sub');
    });

    it('rejects when the email is already linked to a different Apple account', async function () {
      await User.create({
        email: 'taken@example.com',
        firstName: 'Taken',
        appleId: 'sub-existing',
      });

      stubApple(applePayload({ email: 'taken@example.com', sub: 'sub-different' }));

      const res = await request(app)
        .post('/v1/auth/apple')
        .send({ identityToken: 'valid-id-token' });

      assert.equal(res.status, 401);
      const user = await User.findOne({ where: { email: 'taken@example.com' } });
      assert.equal(user?.appleId, 'sub-existing');
    });

    it('returns 401 when identity token verification fails', async function () {
      sinon.stub(appleSignIn, 'verifyIdToken').rejects(new Error('invalid token'));

      const res = await request(app).post('/v1/auth/apple').send({ identityToken: 'bad-id-token' });

      assert.equal(res.status, 401);
    });

    it('returns 400 if APPLE_CLIENT_ID is not set', async function () {
      config.APPLE_CLIENT_ID = undefined;

      const res = await request(app)
        .post('/v1/auth/apple')
        .send({ identityToken: 'valid-id-token' });

      assert.equal(res.status, 400);
    });

    it('returns 400 if identityToken is missing', async function () {
      const res = await request(app).post('/v1/auth/apple').send({});

      assert.equal(res.status, 400);
    });
  });
});
