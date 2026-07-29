let _suppressOutput = false;

function suppressLogger(): void {
  _suppressOutput = true;
}

function enableLogger(): void {
  _suppressOutput = false;
}

function log(...args: unknown[]): void {
  if (
    (process.env.NODE_ENV !== 'test' || process.env.LOGGING_LEVEL === 'verbose') &&
    !_suppressOutput
  ) {
    console.log(...args);
  }
}

function error(...args: unknown[]): void {
  if (
    !_suppressOutput &&
    (process.env.NODE_ENV !== 'test' || process.env.LOGGING_LEVEL === 'verbose')
  ) {
    console.error(...args);
  }
}

function logAndReturnError<T extends Error>(err: T): T {
  error(err);
  return err;
}

const always = {
  log: (...args: unknown[]): void => console.log(...args),
  error: (...args: unknown[]): void => console.error(...args),
};

const logger = {
  log,
  error,
  always,
  logAndReturnError,
  suppressLogger,
  enableLogger,
};

export { always, enableLogger, error, log, logAndReturnError, suppressLogger };
export default logger;
