import { assert } from 'chai';
import { getModeDefinition, quizMode, weaveMode } from './index';
import { SessionVocabItem } from '../types';

const vocab: SessionVocabItem[] = [
  {
    id: '1',
    sourceText: 'the dog',
    term: 'el perro',
    itemType: 'word',
    familiarity: 0,
    bucket: 'new',
  },
  {
    id: '2',
    sourceText: 'to run',
    term: 'correr',
    itemType: 'word',
    familiarity: 3,
    bucket: 'learning',
  },
  {
    id: '3',
    sourceText: 'where is the bathroom?',
    term: '¿dónde está el baño?',
    itemType: 'phrase',
    familiarity: 5,
    bucket: 'known',
  },
];

describe('Voice modes', function () {
  describe('getModeDefinition', function () {
    it('returns the quiz definition', function () {
      assert.equal(getModeDefinition('quiz').mode, 'quiz');
    });
    it('returns the weave definition', function () {
      assert.equal(getModeDefinition('weave').mode, 'weave');
    });
    it('throws on unknown mode', function () {
      assert.throws(() => getModeDefinition('nope' as 'quiz'));
    });
  });

  describe('quiz tutor instructions', function () {
    const text = quizMode.buildTutorInstructions({
      targetLanguage: 'es',
      vocab,
      speech: { slower: false },
    });
    it('includes every target term', function () {
      vocab.forEach((v) => assert.include(text, v.term));
    });
    it('describes per-bucket behavior', function () {
      assert.match(text, /new/i);
      assert.match(text, /known/i);
    });
  });

  describe('quiz evaluation rubric', function () {
    const rubric = quizMode.buildEvaluationRubric({ targetLanguage: 'es', vocab });
    it('lists the outcome vocabulary the evaluator must use', function () {
      ['mastered', 'understood', 'partially_understood', 'missed', 'not_observed'].forEach((o) =>
        assert.include(rubric, o),
      );
    });
  });

  describe('weave tutor instructions', function () {
    it('asks for natural conversation and includes the terms', function () {
      const text = weaveMode.buildTutorInstructions({
        targetLanguage: 'es',
        vocab,
        speech: { slower: true },
      });
      assert.match(text, /conversation/i);
      vocab.forEach((v) => assert.include(text, v.term));
    });
  });
});
