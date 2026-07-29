import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ErrorMessages, ValidationError } from '../utils/errors';

type RequestProperty = 'query' | 'body';

export function checkQueryFor(strArray: string[]) {
  return checkFor('query', strArray);
}

export function checkBodyFor(strArray: string[]) {
  return checkFor('body', strArray);
}

function checkFor(name: RequestProperty, strArray: string[]): RequestHandler {
  return (req, res, next) => {
    const obj = req[name] as Record<string, unknown>;
    const missing = strArray.filter((str) => !Object.prototype.hasOwnProperty.call(obj, str));
    if (missing.length > 0) {
      return next(
        new ValidationError(`${capitalize(name)} parameter(s) missing: ${missing.join(', ')}`, {
          missing,
        }),
      );
    }
    return next();
  };
}

export function checkBodyForAtLeastOneOf(strArray: string[]): RequestHandler {
  return (req, res, next) => {
    const existing = strArray.filter((str) => Object.prototype.hasOwnProperty.call(req.body, str));
    if (!existing.length) {
      return next(
        new ValidationError(
          `Body must include at least one of the following: ${strArray.join(', ')}`,
          { existing },
        ),
      );
    }
    return next();
  };
}

export function checkQueryForAtLeastOneOf(strArray: string[]): RequestHandler {
  return (req, res, next) => {
    const existing = strArray.filter((str) => Object.prototype.hasOwnProperty.call(req.query, str));
    if (!existing.length) {
      return next(
        new ValidationError(
          `Query must include at least one of the following: ${strArray.join(', ')}`,
          { existing },
        ),
      );
    }
    return next();
  };
}

export function checkBodyForAtLeastOneSet(...strArrays: string[][]): RequestHandler {
  return (req, res, next) => {
    const missings = strArrays.map((arr) =>
      arr.filter((str) => !Object.prototype.hasOwnProperty.call(req.body, str)),
    );
    const allMissing = missings.filter((arr) => arr.length > 0);

    if (allMissing.length === strArrays.length) {
      return next(
        new ValidationError(
          `Body parameter(s) missing. This requires a combination like the following: ${strArrays.map((a) => a.join(', ')).join(' | ')}`,
          { details: strArrays },
        ),
      );
    }
    return next();
  };
}

export function checkBodyForNoExtraFields(allowedFields: string[]): RequestHandler {
  return (req, res, next) => {
    const extraFields: string[] = [];
    for (const key of Object.keys(req.body)) {
      if (!allowedFields.includes(key)) {
        extraFields.push(key);
      }
    }
    if (extraFields.length > 0) {
      return next(
        new ValidationError(
          `Body cannot include the parameters: ${extraFields.join(', ')}. This endpoint accepts the values: ${allowedFields.join(', ')}`,
          { extraFields },
        ),
      );
    }
    return next();
  };
}

export function checkQueryForNoExtraFields(allowedFields: string[]): RequestHandler {
  return (req, res, next) => {
    const extraFields: string[] = [];
    for (const key of Object.keys(req.query)) {
      if (!allowedFields.includes(key)) {
        extraFields.push(key);
      }
    }
    if (extraFields.length > 0) {
      return next(
        new ValidationError(
          `Query cannot include the parameters: ${extraFields.join(', ')}. This endpoint accepts the values: ${allowedFields.join(', ')}`,
          { extraFields },
        ),
      );
    }
    return next();
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUIDsInParams(paramArray: string[]): RequestHandler {
  return (req, res, next) => {
    for (const paramName of paramArray) {
      const paramValue = req.params[paramName] as string;
      if (paramValue && !UUID_REGEX.test(paramValue)) {
        return next(new ValidationError(ErrorMessages.invalidUuidFormat(paramName)));
      }
    }
    return next();
  };
}

export function validateUUIDsInQuery(queryArray: string[]): RequestHandler {
  return (req, res, next) => {
    for (const queryName of queryArray) {
      const queryValue = req.query[queryName] as string;
      if (queryValue && !UUID_REGEX.test(queryValue)) {
        return next(new ValidationError(ErrorMessages.invalidUuidFormat(queryName)));
      }
    }
    return next();
  };
}

export function validateUUIDsInBody(bodyArray: string[]): RequestHandler {
  return (req, res, next) => {
    for (const bodyName of bodyArray) {
      const bodyValue = req.body[bodyName];
      if (bodyValue && !UUID_REGEX.test(bodyValue)) {
        return next(new ValidationError(ErrorMessages.invalidUuidFormat(bodyName)));
      }
    }
    return next();
  };
}

export function convertQueryParamToDate(dateParams: string[]): RequestHandler {
  return (req, res, next) => {
    for (const param of dateParams) {
      if (req.query[param] !== undefined && req.query[param] !== null) {
        const parsedDate = new Date(req.query[param] as string);
        if (isNaN(parsedDate.getTime())) {
          return next(new ValidationError(`Invalid Value: ${param} must be a valid date`));
        }
        (req.query as Record<string, unknown>)[param] = parsedDate;
      }
    }
    return next();
  };
}

export function convertBodyParamToDate(dateParams: string[]): RequestHandler {
  return (req, res, next) => {
    for (const param of dateParams) {
      if (req.body[param] !== undefined && req.body[param] !== null) {
        const parsedDate = new Date(req.body[param] as string);
        if (isNaN(parsedDate.getTime())) {
          return next(new ValidationError(`Invalid Value: ${param} must be a valid date`));
        }
        req.body[param] = parsedDate;
      }
    }
    return next();
  };
}

export function convertQueryParamToNumber(numberParams: string[]): RequestHandler {
  return (req, res, next) => {
    for (const param of numberParams) {
      if (req.query[param] !== undefined && req.query[param] !== null) {
        const parsedNumber = Number(req.query[param]);
        if (isNaN(parsedNumber)) {
          return next(new ValidationError(`Invalid Value: ${param} must be a valid number`));
        }
        (req.query as Record<string, unknown>)[param] = parsedNumber;
      }
    }
    return next();
  };
}

export function checkBodyEnum(field: string, allowedValues: readonly string[]): RequestHandler {
  return checkEnum('body', field, allowedValues);
}

export function checkQueryEnum(field: string, allowedValues: readonly string[]): RequestHandler {
  return checkEnum('query', field, allowedValues);
}

function checkEnum(
  objName: RequestProperty,
  field: string,
  allowedValues: readonly string[],
): RequestHandler {
  return (req, res, next) => {
    const value = (req[objName] as Record<string, unknown>)[field];
    if (!value || !allowedValues.includes(value as string)) {
      return next(new ValidationError(ErrorMessages.invalidBodyField(field, [...allowedValues])));
    }
    return next();
  };
}

export function oneOf(
  middlewares: Array<(req: Request, res: Response, next: NextFunction) => void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Error[] = [];

    const tryNextMiddleware = (index: number) => {
      if (index >= middlewares.length) {
        if (errors.length === 0) {
          next(new ValidationError('None of the validation options passed'));
        } else if (errors.length === 1) {
          next(errors[0]);
        } else {
          const combinedMessage = errors.map((err) => err.message).join(' OR ');
          const firstError = errors[0];
          firstError.message = combinedMessage;
          next(firstError);
        }
        return;
      }

      const middleware = middlewares[index];

      const middlewareNext: NextFunction = (err) => {
        if (err) {
          errors.push(err instanceof Error ? err : new Error(String(err)));
          tryNextMiddleware(index + 1);
        } else {
          next();
        }
      };

      middleware(req, res, middlewareNext);
    };

    tryNextMiddleware(0);
  };
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
