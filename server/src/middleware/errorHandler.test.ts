import { assert } from 'chai';
import { errorHandler } from './errorHandler';
import { NotFoundError, ValidationError, AppError } from '../utils/errors';
import { NextFunction, Request, Response } from 'express';

type MockResponse = Partial<Response> & {
  statusCode?: number;
  jsonPayload?: unknown;
};

function createMockRes(): MockResponse {
  return {
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this as unknown as Response;
    },
    json(payload: unknown) {
      this.jsonPayload = payload;
      return this as unknown as Response;
    },
  };
}

describe('errorHandler', () => {
  it('translates known errors to status codes', () => {
    const req = { path: '/test', method: 'GET' } as Request;
    const res = createMockRes();

    errorHandler(new NotFoundError('missing'), req, res as Response, (() => {}) as NextFunction);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.jsonPayload, {
      error: {
        message: 'missing',
      },
    });
  });

  it('includes validation data when available', () => {
    const req = { path: '/validation', method: 'POST' } as Request;
    const res = createMockRes();
    const validationError = new ValidationError('Invalid data', [{ field: 'name' }]);

    errorHandler(validationError, req, res as Response, (() => {}) as NextFunction);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.jsonPayload, {
      error: {
        message: 'Invalid data',
        data: [{ field: 'name' }],
      },
    });
  });

  it('falls back to 500 for unknown errors', () => {
    const req = { path: '/boom', method: 'GET' } as Request;
    const res = createMockRes();
    const err = new Error('boom');

    errorHandler(err, req, res as Response, (() => {}) as NextFunction);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.jsonPayload, {
      error: {
        message: 'boom',
      },
    });
  });

  it('does nothing when headers already sent', () => {
    const req = { path: '/sent', method: 'GET' } as Request;
    const nextCalls: unknown[] = [];
    const res: MockResponse = {
      headersSent: true,
    };

    errorHandler(
      new AppError('irrelevant'),
      req,
      res as Response,
      ((err) => nextCalls.push(err)) as NextFunction,
    );

    assert.equal(nextCalls.length, 1);
    assert.instanceOf(nextCalls[0] as Error, AppError);
  });
});
