import {
  ModeInstructionInput,
  ModeRubricInput,
  SessionVocabItem,
  VoiceModeDefinition,
} from '../types';

function renderWordList(vocab: SessionVocabItem[]): string {
  return vocab.map((v) => `- "${v.term}" (${v.sourceText}) [${v.itemType}]`).join('\n');
}

export const weaveMode: VoiceModeDefinition = {
  mode: 'weave',
  expectedObservationTypes: ['contextual_use'],

  buildTutorInstructions({ vocab, speech }: ModeInstructionInput): string {
    return [
      'You are a warm, friendly Spanish conversation partner. Speak in Spanish.',
      'Have a natural, flowing conversation with the learner. Work the words below into the conversation naturally — steer topics so they fit — but do NOT quiz mechanically.',
      'As you go, pay attention to whether the learner understands each target word when it comes up.',
      speech.slower ? 'Speak slowly and clearly, pausing between phrases.' : '',
      '',
      'Words to work in:',
      renderWordList(vocab),
    ]
      .filter(Boolean)
      .join('\n');
  },

  buildEvaluationRubric({ vocab }: ModeRubricInput): string {
    return [
      'You are assessing, from a Spanish conversation transcript, whether the learner understood each target word IN CONTEXT.',
      'For EACH target word, decide one outcome:',
      '- "mastered": used or responded to the word fluently and correctly.',
      '- "understood": clearly understood it when it came up.',
      '- "partially_understood": unclear or hesitant understanding.',
      '- "missed": misunderstood it, or responded as if they did not know it.',
      '- "not_observed": the word never came up in the conversation.',
      'Base the decision ONLY on the transcript. Cite the transcript turn indexes you used.',
      '',
      'Target words:',
      renderWordList(vocab),
    ].join('\n');
  },
};
