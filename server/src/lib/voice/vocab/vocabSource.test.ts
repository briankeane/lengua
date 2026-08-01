import { assert } from 'chai';
import { getSessionVocab, SESSION_WORD_COUNT } from './vocabSource';
import { createUser, createVocabItem } from '../../../test/testDataGenerator';

describe('getSessionVocab', function () {
  it('returns only the given user’s items for the language', async function () {
    const user = await createUser();
    const other = await createUser();
    await createVocabItem({ userId: user.id, term: 'perro', targetLanguageCode: 'es' });
    await createVocabItem({ userId: other.id, term: 'gato', targetLanguageCode: 'es' });

    const result = await getSessionVocab({ userId: user.id, targetLanguage: 'es' });
    assert.equal(result.length, 1);
    assert.equal(result[0].term, 'perro');
  });

  it('caps the session at SESSION_WORD_COUNT', async function () {
    const user = await createUser();
    for (let i = 0; i < SESSION_WORD_COUNT + 3; i++) {
      await createVocabItem({ userId: user.id, term: `palabra-${i}`, targetLanguageCode: 'es' });
    }
    const result = await getSessionVocab({ userId: user.id, targetLanguage: 'es' });
    assert.equal(result.length, SESSION_WORD_COUNT);
  });

  it('returns the seam shape with familiarity', async function () {
    const user = await createUser();
    await createVocabItem({
      userId: user.id,
      term: 'correr',
      sourceText: 'to run',
      targetLanguageCode: 'es',
    });
    const [item] = await getSessionVocab({ userId: user.id, targetLanguage: 'es' });
    assert.hasAllKeys(item, [
      'id',
      'sourceText',
      'term',
      'itemType',
      'partOfSpeech',
      'familiarity',
    ]);
    assert.isNumber(item.familiarity);
  });
});
