import { assert } from 'chai';
import nock from 'nock';
import request from 'supertest';
import app from '../../server';
import config from '../../config/config';
import { createUserWithToken } from '../../test/testDataGenerator';

describe('Translate API', function () {
  const FREE_HOST = 'https://api-free.deepl.com';

  beforeEach(function () {
    config.DEEPL_API_KEY = 'test-key:fx';
  });

  afterEach(function () {
    delete config.DEEPL_API_KEY;
  });

  it('returns 401 without authentication', async function () {
    await request(app)
      .post('/v1/translate')
      .send({ text: 'hello', direction: 'en-es' })
      .expect(401);
  });

  it('translates authenticated input via DeepL', async function () {
    const { token } = await createUserWithToken();
    nock(FREE_HOST)
      .post('/v2/translate')
      .reply(200, { translations: [{ text: 'hola' }] });

    const res = await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello', direction: 'en-es' })
      .expect(200);

    assert.deepEqual(res.body, { text: 'hola', direction: 'en-es' });
  });

  it('returns empty text for blank input without calling DeepL', async function () {
    const { token } = await createUserWithToken();
    // No nock interceptor: the test setup fails if any DeepL request is made.
    const res = await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '   ', direction: 'en-es' })
      .expect(200);

    assert.deepEqual(res.body, { text: '', direction: 'en-es' });
  });

  it('returns 400 when text is missing', async function () {
    const { token } = await createUserWithToken();
    await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'en-es' })
      .expect(400);
  });

  it('returns 400 for an unsupported direction', async function () {
    const { token } = await createUserWithToken();
    await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello', direction: 'en-fr' })
      .expect(400);
  });

  it('returns 400 for extra body fields', async function () {
    const { token } = await createUserWithToken();
    await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello', direction: 'en-es', extra: true })
      .expect(400);
  });

  it('maps a DeepL 429 to 429', async function () {
    const { token } = await createUserWithToken();
    nock(FREE_HOST).post('/v2/translate').reply(429, 'Too Many Requests');
    await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello', direction: 'en-es' })
      .expect(429);
  });

  it('maps a DeepL 500 to 502', async function () {
    const { token } = await createUserWithToken();
    nock(FREE_HOST).post('/v2/translate').reply(500, 'boom');
    await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello', direction: 'en-es' })
      .expect(502);
  });
});
