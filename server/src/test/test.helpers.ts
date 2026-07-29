import { assert } from 'chai';
import nock from 'nock';
import { Model, ModelStatic } from 'sequelize';
import config from '../config/config';
import sequelize from '../db/sequelize';
import logger from '../logger';

export async function clearDatabase() {
  if (config.NODE_ENV !== 'test') return;

  await sequelize.query('SET session_replication_role = replica;');

  const models = sequelize.models;
  for (const modelName of Object.keys(models)) {
    await models[modelName].destroy({
      where: {},
      cascade: true,
      force: true,
    });
  }

  await sequelize.query('SET session_replication_role = DEFAULT;');
}

export async function waitForInstanceToExist<T extends Model>(
  model: ModelStatic<T>,
  query: object,
  timeout = 1000,
  elapsed = 0,
): Promise<T> {
  const results = await model.findAll(query);
  if (results.length) {
    return results[0];
  }
  if (elapsed >= timeout) {
    throw assert.fail('model failed to create within timeout');
  }
  return waitForInstanceToExist(model, query, timeout, elapsed + 10);
}

export async function assertInstancePropertyEventuallyEquals(
  instance: Model,
  propertyName: string,
  expectedValue: unknown,
  timeout = 1000,
  elapsed = 0,
): Promise<boolean> {
  await instance.reload();
  const actual = (instance as unknown as Record<string, unknown>)[propertyName];
  if (actual === expectedValue) {
    return true;
  }
  if (elapsed >= timeout) {
    throw assert.fail(
      `expected ${propertyName} to eventually equal ${expectedValue}, got ${actual}`,
    );
  }
  return assertInstancePropertyEventuallyEquals(
    instance,
    propertyName,
    expectedValue,
    timeout,
    elapsed + 10,
  );
}

export function checkAndClearNocks() {
  if (!nock.isDone()) {
    logger.always.log('remaining Nocks: ' + JSON.stringify(nock.pendingMocks(), null, 2));
    throw assert.fail('Not all nock interceptors were used!');
  }
  nock.cleanAll();
}

export function extractIds(arr: Array<{ id: unknown }>) {
  return arr.map((obj) => obj.id);
}

export function parseJwt(token: string): unknown {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const buff = Buffer.from(base64, 'base64');
  return JSON.parse(buff.toString('ascii'));
}
