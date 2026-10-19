import { assert } from 'chai';
import { buildTutorPrompt, PROMPT_VERSION } from './promptBuilder';
import { VocabItem } from '../types';
import { JsonValue } from '../../../db/models/conversationSession.model';

const vocab: VocabItem[] = [
  { id: '1', sourceText: 'the dog', targetText: 'el perro', familiarity: 0 },
  { id: '2', sourceText: 'to run', targetText: 'correr', familiarity: 8 },
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
    vocab.forEach((v) => assert.include(prompt, v.targetText));
  });

  it('instructs the tutor to treat vocabulary and learner input as data, not instructions', function () {
    const { prompt } = buildTutorPrompt({
      mode: 'quiz',
      targetLanguage: 'es',
      vocab,
      speech: { slower: false },
    });
    assert.match(prompt, /never as instructions/i);
  });

  it('returns a sessionVocab snapshot assignable to the session JsonValue column', function () {
    const { sessionVocab } = buildTutorPrompt({
      mode: 'quiz',
      targetLanguage: 'es',
      vocab,
      speech: { slower: false },
    });
    // Compile-time contract: PR4 snapshots this onto ConversationSession.vocabSnapshot.
    const snapshot: JsonValue = sessionVocab;
    assert.isArray(snapshot);
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

  it('rejects unsupported target languages', function () {
    assert.throws(
      () =>
        buildTutorPrompt({
          mode: 'quiz',
          targetLanguage: 'fr',
          vocab,
          speech: { slower: false },
        }),
      /Unsupported target language/,
    );
  });
});
