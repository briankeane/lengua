import { assert } from 'chai';
import { Request, Response } from 'express';
import { PermissionError } from '../utils/errors';
import {
  requireRoleOfAtLeast,
  isOperatingOnSelf,
  ROLE_HIERARCHY,
  AuthenticatedRequest,
} from './security';

function mockAuthReq(
  auth: Partial<AuthenticatedRequest['auth']>,
  overrides: Partial<Request> = {},
): Request {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    auth: {
      id: 'user-123',
      email: 'test@test.com',
      role: 'user',
      ...auth,
    },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('Security Middleware', function () {
  describe('ROLE_HIERARCHY', function () {
    it('should define guest < user < admin', function () {
      assert.isBelow(ROLE_HIERARCHY.guest, ROLE_HIERARCHY.user);
      assert.isBelow(ROLE_HIERARCHY.user, ROLE_HIERARCHY.admin);
    });
  });

  describe('requireRoleOfAtLeast', function () {
    it('should pass when user has the required role', function (done) {
      const middleware = requireRoleOfAtLeast('user');
      const req = mockAuthReq({ role: 'user' });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should pass when user has a higher role than required', function (done) {
      const middleware = requireRoleOfAtLeast('user');
      const req = mockAuthReq({ role: 'admin' });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail when user has a lower role than required', function (done) {
      const middleware = requireRoleOfAtLeast('admin');
      const req = mockAuthReq({ role: 'user' });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, PermissionError);
        done();
      });
    });

    it('should fail when user has guest role and user is required', function (done) {
      const middleware = requireRoleOfAtLeast('user');
      const req = mockAuthReq({ role: 'guest' });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, PermissionError);
        done();
      });
    });

    it('should pass guest for guest-level access', function (done) {
      const middleware = requireRoleOfAtLeast('guest');
      const req = mockAuthReq({ role: 'guest' });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });
  });

  describe('isOperatingOnSelf', function () {
    it('should pass when user operates on themselves (params)', function (done) {
      const middleware = isOperatingOnSelf('userId');
      const req = mockAuthReq({ id: 'user-123' }, { params: { userId: 'user-123' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail when user operates on another user (params)', function (done) {
      const middleware = isOperatingOnSelf('userId');
      const req = mockAuthReq({ id: 'user-123' }, { params: { userId: 'user-456' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, PermissionError);
        assert.include((err as Error).message, 'your own account');
        done();
      });
    });

    it('should pass when user operates on themselves (body)', function (done) {
      const middleware = isOperatingOnSelf('userId', 'body');
      const req = mockAuthReq({ id: 'user-123' });
      req.body = { userId: 'user-123' };
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail when user operates on another user (body)', function (done) {
      const middleware = isOperatingOnSelf('userId', 'body');
      const req = mockAuthReq({ id: 'user-123' });
      req.body = { userId: 'user-456' };
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, PermissionError);
        done();
      });
    });
  });
});
