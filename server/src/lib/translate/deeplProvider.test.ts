import { assert } from 'chai';
import nock from 'nock';
import * as sinon from 'sinon';
import config from '../../config/config';
import { RateLimitError, ServerError, UpstreamError } from '../../utils/errors';
import { deeplProvider } from './deeplProvider';

describe('deeplProvider', function () {
  const FREE_HOST = 'https://api-free.deepl.com';

  beforeEach(function () {
    config.DEEPL_API_KEY = 'test-key:fx'; // ":fx" selects the free host
  });

  afterEach(function () {
    delete config.DEEPL_API_KEY;
    sinon.restore();
  });

  it('POSTs to DeepL and returns the translated text', async function () {
    const scope = nock(FREE_HOST)
      .post('/v2/translate', (body: string) => {
        const params = new URLSearchParams(body);
        return (
          params.get('text') === 'hello' &&
          params.get('source_lang') === 'EN' &&
          params.get('target_lang') === 'ES'
        );
      })
      .matchHeader('authorization', 'DeepL-Auth-Key test-key:fx')
      .reply(200, { translations: [{ text: 'hola' }] });

    const result = await deeplProvider.translate({
      text: 'hello',
      sourceLang: 'EN',
      targetLang: 'ES',
    });

    assert.equal(result, 'hola');
    assert.isTrue(scope.isDone());
  });

  it('throws RateLimitError on 429', async function () {
    nock(FREE_HOST).post('/v2/translate').reply(429, 'Too Many Requests');
    try {
      await deeplProvider.translate({ text: 'hello', sourceLang: 'EN', targetLang: 'ES' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, RateLimitError);
    }
  });

  it('throws UpstreamError on other DeepL failure', async function () {
    nock(FREE_HOST).post('/v2/translate').reply(500, 'boom');
    try {
      await deeplProvider.translate({ text: 'hello', sourceLang: 'EN', targetLang: 'ES' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, UpstreamError);
    }
  });

  it('throws UpstreamError when the response body is not valid JSON', async function () {
    nock(FREE_HOST).post('/v2/translate').reply(200, 'not json at all');
    try {
      await deeplProvider.translate({ text: 'hello', sourceLang: 'EN', targetLang: 'ES' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, UpstreamError);
    }
  });

  it('throws ServerError when the API key is missing', async function () {
    delete config.DEEPL_API_KEY;
    try {
      await deeplProvider.translate({ text: 'hello', sourceLang: 'EN', targetLang: 'ES' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, ServerError);
    }
  });
});
