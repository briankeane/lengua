import express from 'express';
import morgan from 'morgan';
import request from 'supertest';
import { assert } from 'chai';

import { skipSuccessfulHealthCheck } from './healthCheckLogging';

// The health-check router is mounted via app.use(path, router), so a predicate
// that reads req.path (stripped to "/" inside a mounted router) never matches
// and nothing gets suppressed. These tests run real requests through a real
// mounted router + Morgan so the req.baseUrl vs req.path distinction is
// exercised exactly as in production.
describe('skipSuccessfulHealthCheck (Morgan log suppression)', function () {
  function buildApp(healthStatus: number) {
    const app = express();
    const lines: string[] = [];

    app.use(
      morgan('dev', {
        skip: skipSuccessfulHealthCheck,
        stream: {
          write: (line: string) => {
            lines.push(line);
            return true;
          },
        },
      }),
    );

    const healthRouter = express.Router();
    healthRouter.get('/', (_req, res) => {
      res.status(healthStatus).json({ healthy: healthStatus < 400 });
    });
    // Mounted exactly like production (see api/routes.ts).
    app.use('/v1/healthCheck', healthRouter);

    app.get('/v1/users', (_req, res) => res.status(200).json({ ok: true }));

    return { app, lines };
  }

  // Morgan logs on the response "finish" event, which can fire a tick after
  // supertest resolves. Give it a moment so assertions are deterministic.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

  it('does NOT log a successful (200) health-check', async function () {
    const { app, lines } = buildApp(200);
    await request(app).get('/v1/healthCheck').expect(200);
    await settle();
    assert.deepEqual(lines, [], `expected no log lines, got: ${lines.join('')}`);
  });

  it('DOES log a failing (503) health-check so outages stay visible', async function () {
    const { app, lines } = buildApp(503);
    await request(app).get('/v1/healthCheck').expect(503);
    await settle();
    assert.equal(lines.length, 1);
    assert.match(lines[0], /\/v1\/healthCheck/);
  });

  it('DOES log non-health-check requests', async function () {
    const { app, lines } = buildApp(200);
    await request(app).get('/v1/users').expect(200);
    await settle();
    assert.equal(lines.length, 1);
    assert.match(lines[0], /users/);
  });
});
