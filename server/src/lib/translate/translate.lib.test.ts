import { assert } from 'chai';
import * as sinon from 'sinon';
import { ValidationError } from '../../utils/errors';
import { MAX_INPUT_LENGTH, translateText } from './translate.lib';
import type { TranslateProvider } from './deeplProvider';

function fakeProvider(returnText = 'hola'): TranslateProvider & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async translate(input) {
      calls.push(input);
      return returnText;
    },
  };
}

describe('translateText', function () {
  it('returns empty text and does not call the provider for blank input', async function () {
    const provider = fakeProvider();
    const result = await translateText({ text: '   ', direction: 'en-es' }, provider);
    assert.deepEqual(result, { text: '', direction: 'en-es' });
    assert.lengthOf(provider.calls, 0);
  });

  it('maps en-es to EN->ES', async function () {
    const provider = fakeProvider('hola');
    const result = await translateText({ text: 'hello', direction: 'en-es' }, provider);
    assert.equal(result.text, 'hola');
    assert.deepEqual(provider.calls[0], { text: 'hello', sourceLang: 'EN', targetLang: 'ES' });
  });

  it('maps es-en to ES->EN', async function () {
    const provider = fakeProvider('hello');
    const result = await translateText({ text: 'hola', direction: 'es-en' }, provider);
    assert.equal(result.text, 'hello');
    assert.deepEqual(provider.calls[0], { text: 'hola', sourceLang: 'ES', targetLang: 'EN' });
  });

  it('throws ValidationError when text exceeds the max length', async function () {
    const provider = fakeProvider();
    const longText = 'a'.repeat(MAX_INPUT_LENGTH + 1);
    try {
      await translateText({ text: longText, direction: 'en-es' }, provider);
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, ValidationError);
    }
    assert.lengthOf(provider.calls, 0);
  });

  it('throws ValidationError when text is not a string', async function () {
    const provider = fakeProvider();
    try {
      // @ts-expect-error deliberately passing a wrong type
      await translateText({ text: 42, direction: 'en-es' }, provider);
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, ValidationError);
    }
  });

  it('uses the deeplProvider by default', async function () {
    const mod = await import('./deeplProvider');
    const stub = sinon.stub(mod.deeplProvider, 'translate').resolves('hola');
    const result = await translateText({ text: 'hello', direction: 'en-es' });
    assert.equal(result.text, 'hola');
    assert.isTrue(stub.calledOnce);
    stub.restore();
  });
});
