import { assert } from 'chai';
import { buildTutorPrompt, PROMPT_VERSION } from './promptBuilder';
import { VocabItem } from '../types';

const vocab: VocabItem[] = [
  { id: '1', sourceText: 'the dog', term: 'el perro', itemType: 'word', familiarity: 0 },
  { id: '2', sourceText: 'to run', term: 'correr', itemType: 'word', familiarity: 5 },
];

describe('buildTutorPrompt', function () {
  it('assembles a prompt containing the mode instructions and every term', function () {
    const { prompt } = buildTutorPrompt({
      mode: 'quiz',
      targetLanguage: 'es',
      vocab,
      speech: { slower: false },
    });
    assert.match(prompt, /Spanish/i);
    vocab.forEach((v) => assert.include(prompt, v.term));
  });

  it('derives and exposes buckets on sessionVocab', function () {
    const { sessionVocab } = buildTutorPrompt({
      mode: 'quiz',
      targetLanguage: 'es',
      vocab,
      speech: { slower: false },
    });
    assert.equal(sessionVocab.find((v) => v.id === '1')?.bucket, 'new');
    assert.equal(sessionVocab.find((v) => v.id === '2')?.bucket, 'known');
  });

  it('adds a slower-speech instruction when requested', function () {
    const withSlow = buildTutorPrompt({
      mode: 'weave',
      targetLanguage: 'es',
      vocab,
      speech: { slower: true },
    }).prompt;
    const without = buildTutorPrompt({
      mode: 'weave',
      targetLanguage: 'es',
      vocab,
      speech: { slower: false },
    }).prompt;
    assert.match(withSlow, /slowly/i);
    assert.notMatch(without, /slowly/i);
  });

  it('stamps a prompt version', function () {
    const { promptVersion } = buildTutorPrompt({
      mode: 'quiz',
      targetLanguage: 'es',
      vocab,
      speech: { slower: false },
    });
    assert.equal(promptVersion, PROMPT_VERSION);
  });
});
