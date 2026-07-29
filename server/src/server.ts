import bodyParser from 'body-parser';
import compression from 'compression';
import express from 'express';
import bearerToken from 'express-bearer-token';
import http from 'http';
import morgan from 'morgan';
import addRoutes from './api/routes';
import config from './config/config';
import addDocRoutes from './docs';
import logger from './logger';
import { errorHandler } from './middleware/errorHandler';

export type AppWithIsReadyPromise = express.Application & {
  isReadyPromise: Promise<void>;
};

const port = config.PORT;
const app = express() as unknown as AppWithIsReadyPromise;

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header(
    'Access-Control-Allow-Headers',
    'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization',
  );
  if ('OPTIONS' === req.method) {
    res.status(200).end();
  } else {
    next();
  }
});

// Express 5 makes req.query a read-only getter. Restore writable behavior
// so existing middleware (convertQueryParamToDate, etc.) can mutate it.
app.use(function (req, _res, next) {
  Object.defineProperty(req, 'query', {
    ...Object.getOwnPropertyDescriptor(req, 'query'),
    value: req.query,
    writable: true,
  });
  next();
});

// Express 5 defaults to "simple" query parser; use "extended" (qs) for nested object support
app.set('query parser', 'extended');

app.use(bearerToken());
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const setupPromises: Promise<unknown>[] = [];

if (config.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

const server = http.createServer(app);
addRoutes(app);
addDocRoutes(app);
app.use(errorHandler);

if (require.main === module) {
  server.listen(port);
}

app.isReadyPromise = new Promise((resolve, reject) => {
  return Promise.all(setupPromises)
    .then(() => {
      return resolve();
    })
    .catch((err) => {
      logger.error(err);
      return reject(err);
    });
});

export default app;
