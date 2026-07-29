import { assert } from 'chai';
import { Request, Response } from 'express';
import { ValidationError } from '../utils/errors';
import {
  checkQueryFor,
  checkBodyFor,
  checkBodyForAtLeastOneOf,
  checkQueryForAtLeastOneOf,
  checkBodyForAtLeastOneSet,
  checkBodyForNoExtraFields,
  checkQueryForNoExtraFields,
  validateUUIDsInParams,
  validateUUIDsInQuery,
  validateUUIDsInBody,
  convertQueryParamToDate,
  convertBodyParamToDate,
  convertQueryParamToNumber,
  checkBodyEnum,
  checkQueryEnum,
  oneOf,
} from './validation';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('Validation Middleware', function () {
  describe('checkQueryFor', function () {
    it('should pass when all required query params are present', function (done) {
      const middleware = checkQueryFor(['page', 'limit']);
      const req = mockReq({ query: { page: '1', limit: '10' } as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail when required query params are missing', function (done) {
      const middleware = checkQueryFor(['page', 'limit']);
      const req = mockReq({ query: { page: '1' } as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        assert.include((err as Error).message, 'limit');
        done();
      });
    });
  });

  describe('checkBodyFor', function () {
    it('should pass when all required body fields are present', function (done) {
      const middleware = checkBodyFor(['name', 'email']);
      const req = mockReq({ body: { name: 'Test', email: 'a@b.com' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail when required body fields are missing', function (done) {
      const middleware = checkBodyFor(['name', 'email']);
      const req = mockReq({ body: { name: 'Test' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        assert.include((err as Error).message, 'email');
        done();
      });
    });
  });

  describe('checkBodyForAtLeastOneOf', function () {
    it('should pass when at least one field is present', function (done) {
      const middleware = checkBodyForAtLeastOneOf(['name', 'email']);
      const req = mockReq({ body: { name: 'Test' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail when no fields are present', function (done) {
      const middleware = checkBodyForAtLeastOneOf(['name', 'email']);
      const req = mockReq({ body: {} });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        done();
      });
    });
  });

  describe('checkQueryForAtLeastOneOf', function () {
    it('should pass when at least one query param is present', function (done) {
      const middleware = checkQueryForAtLeastOneOf(['search', 'filter']);
      const req = mockReq({ query: { search: 'test' } as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail when no query params are present', function (done) {
      const middleware = checkQueryForAtLeastOneOf(['search', 'filter']);
      const req = mockReq({ query: {} as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        done();
      });
    });
  });

  describe('checkBodyForAtLeastOneSet', function () {
    it('should pass when one complete set is present', function (done) {
      const middleware = checkBodyForAtLeastOneSet(['email', 'password'], ['token']);
      const req = mockReq({ body: { token: 'abc' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail when no complete set is present', function (done) {
      const middleware = checkBodyForAtLeastOneSet(['email', 'password'], ['token']);
      const req = mockReq({ body: { email: 'test@test.com' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        done();
      });
    });
  });

  describe('checkBodyForNoExtraFields', function () {
    it('should pass when no extra fields are present', function (done) {
      const middleware = checkBodyForNoExtraFields(['name', 'email']);
      const req = mockReq({ body: { name: 'Test' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail when extra fields are present', function (done) {
      const middleware = checkBodyForNoExtraFields(['name', 'email']);
      const req = mockReq({ body: { name: 'Test', hack: 'true' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        assert.include((err as Error).message, 'hack');
        done();
      });
    });
  });

  describe('checkQueryForNoExtraFields', function () {
    it('should pass when no extra query fields are present', function (done) {
      const middleware = checkQueryForNoExtraFields(['page', 'limit']);
      const req = mockReq({ query: { page: '1' } as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail when extra query fields are present', function (done) {
      const middleware = checkQueryForNoExtraFields(['page', 'limit']);
      const req = mockReq({ query: { page: '1', extra: 'bad' } as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        assert.include((err as Error).message, 'extra');
        done();
      });
    });
  });

  describe('validateUUIDsInParams', function () {
    it('should pass for valid UUIDs', function (done) {
      const middleware = validateUUIDsInParams(['id']);
      const req = mockReq({
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail for invalid UUIDs', function (done) {
      const middleware = validateUUIDsInParams(['id']);
      const req = mockReq({ params: { id: 'not-a-uuid' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        assert.include((err as Error).message, 'id');
        done();
      });
    });

    it('should skip missing params', function (done) {
      const middleware = validateUUIDsInParams(['id']);
      const req = mockReq({ params: {} });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });
  });

  describe('validateUUIDsInQuery', function () {
    it('should pass for valid UUIDs in query', function (done) {
      const middleware = validateUUIDsInQuery(['userId']);
      const req = mockReq({
        query: { userId: '550e8400-e29b-41d4-a716-446655440000' } as never,
      });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail for invalid UUIDs in query', function (done) {
      const middleware = validateUUIDsInQuery(['userId']);
      const req = mockReq({ query: { userId: 'invalid' } as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        done();
      });
    });
  });

  describe('validateUUIDsInBody', function () {
    it('should pass for valid UUIDs in body', function (done) {
      const middleware = validateUUIDsInBody(['userId']);
      const req = mockReq({
        body: { userId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail for invalid UUIDs in body', function (done) {
      const middleware = validateUUIDsInBody(['userId']);
      const req = mockReq({ body: { userId: 'invalid' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        done();
      });
    });
  });

  describe('convertQueryParamToDate', function () {
    it('should convert valid date strings', function (done) {
      const middleware = convertQueryParamToDate(['startDate']);
      const req = mockReq({
        query: { startDate: '2024-01-15' } as never,
      });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        assert.instanceOf(req.query.startDate, Date);
        done();
      });
    });

    it('should fail for invalid date strings', function (done) {
      const middleware = convertQueryParamToDate(['startDate']);
      const req = mockReq({
        query: { startDate: 'not-a-date' } as never,
      });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        assert.include((err as Error).message, 'startDate');
        done();
      });
    });

    it('should skip missing params', function (done) {
      const middleware = convertQueryParamToDate(['startDate']);
      const req = mockReq({ query: {} as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });
  });

  describe('convertBodyParamToDate', function () {
    it('should convert valid date strings in body', function (done) {
      const middleware = convertBodyParamToDate(['dueDate']);
      const req = mockReq({ body: { dueDate: '2024-06-01' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        assert.instanceOf(req.body.dueDate, Date);
        done();
      });
    });

    it('should fail for invalid date strings in body', function (done) {
      const middleware = convertBodyParamToDate(['dueDate']);
      const req = mockReq({ body: { dueDate: 'nope' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        done();
      });
    });
  });

  describe('convertQueryParamToNumber', function () {
    it('should convert valid number strings', function (done) {
      const middleware = convertQueryParamToNumber(['limit']);
      const req = mockReq({ query: { limit: '25' } as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        assert.equal(req.query.limit as unknown, 25);
        done();
      });
    });

    it('should fail for non-numeric strings', function (done) {
      const middleware = convertQueryParamToNumber(['limit']);
      const req = mockReq({ query: { limit: 'abc' } as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        assert.include((err as Error).message, 'limit');
        done();
      });
    });
  });

  describe('checkBodyEnum', function () {
    it('should pass for valid enum values', function (done) {
      const middleware = checkBodyEnum('role', ['admin', 'user', 'guest']);
      const req = mockReq({ body: { role: 'admin' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail for invalid enum values', function (done) {
      const middleware = checkBodyEnum('role', ['admin', 'user', 'guest']);
      const req = mockReq({ body: { role: 'superadmin' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        done();
      });
    });
  });

  describe('checkQueryEnum', function () {
    it('should pass for valid enum values in query', function (done) {
      const middleware = checkQueryEnum('sort', ['asc', 'desc']);
      const req = mockReq({ query: { sort: 'asc' } as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail for invalid enum values in query', function (done) {
      const middleware = checkQueryEnum('sort', ['asc', 'desc']);
      const req = mockReq({ query: { sort: 'random' } as never });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.instanceOf(err, ValidationError);
        done();
      });
    });
  });

  describe('oneOf', function () {
    it('should pass if the first middleware succeeds', function (done) {
      const middleware = oneOf([checkBodyFor(['name']), checkBodyFor(['email'])]);
      const req = mockReq({ body: { name: 'Test' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should pass if the second middleware succeeds', function (done) {
      const middleware = oneOf([checkBodyFor(['name']), checkBodyFor(['email'])]);
      const req = mockReq({ body: { email: 'test@test.com' } });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isUndefined(err);
        done();
      });
    });

    it('should fail if all middlewares fail', function (done) {
      const middleware = oneOf([checkBodyFor(['name']), checkBodyFor(['email'])]);
      const req = mockReq({ body: {} });
      middleware(req, mockRes(), (err?: unknown) => {
        assert.isOk(err);
        assert.include((err as Error).message, 'OR');
        done();
      });
    });
  });
});
