import {
  ModeInstructionInput,
  ModeRubricInput,
  SessionVocabItem,
  VoiceModeDefinition,
} from '../types';

function renderWordList(vocab: SessionVocabItem[]): string {
  return vocab
    .map((v) => `- "${v.term}" (${v.sourceText}) [${v.itemType}, level: ${v.bucket}]`)
    .join('\n');
}

export const quizMode: VoiceModeDefinition = {
  mode: 'quiz',
  expectedObservationTypes: ['describe_to_name', 'name_to_define'],

  buildTutorInstructions({ vocab, speech }: ModeInstructionInput): string {
    return [
      'You are a warm, patient Spanish tutor running a short vocabulary quiz. Speak in Spanish.',
      'Quiz the learner on the words below, ONE at a time, and adapt to each word’s level:',
      '- level "new": do not quiz cold. Introduce the word, say it clearly, give a simple example, then ask a gentle recognition question (describe it in Spanish and let them name it).',
      '- level "learning": quiz them. Vary between describing the word in Spanish for them to name, and saying the word for them to define or use in a sentence.',
      '- level "known": challenge them. Say the word and ask them to define it or use it in a Spanish sentence.',
      'Give brief, encouraging feedback after each answer. Keep it conversational, not a rigid drill.',
      speech.slower ? 'Speak slowly and clearly, pausing between phrases.' : '',
      '',
      'Words for this session:',
      renderWordList(vocab),
    ]
      .filter(Boolean)
      .join('\n');
  },

  buildEvaluationRubric({ vocab }: ModeRubricInput): string {
    return [
      'You are grading a Spanish vocabulary quiz from its transcript.',
      'For EACH target word, decide one outcome:',
      '- "mastered": answered correctly and confidently at a challenging level.',
      '- "understood": answered correctly.',
      '- "partially_understood": partially correct, hesitant, or needed a hint.',
      '- "missed": asked but wrong or no usable answer.',
      '- "not_observed": the word was never actually tested (e.g., the call ended first).',
      'Base the decision ONLY on the transcript. Cite the transcript turn indexes you used.',
      '',
      'Target words:',
      renderWordList(vocab),
    ].join('\n');
  },
};
