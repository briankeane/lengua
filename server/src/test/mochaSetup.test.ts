import { after, afterEach, before } from 'mocha';
import nock from 'nock';
import { performance } from 'node:perf_hooks';
import app from '../server';
import { clearDatabase } from './test.helpers';

const testRunStart = performance.now();

nock.disableNetConnect();
nock.enableNetConnect('127.0.0.1');

before(async function (this: Mocha.Context) {
  this.timeout(5000);
  await app.isReadyPromise;
  await clearDatabase();
});

afterEach(async function () {
  await clearDatabase();
});

after(function () {
  nock.cleanAll();
  nock.restore();

  const durationSeconds = ((performance.now() - testRunStart) / 1000).toFixed(2);
  console.log(`Total test duration: ${durationSeconds}s`);
});
