import { VoiceMode } from '../../../db/models/conversationSession.model';
import { bucketFor } from '../familiarity';
import { getModeDefinition } from '../modes';
import { SessionVocabItem, VocabItem } from '../types';

export const PROMPT_VERSION = 'voice-prompt-v1';

// v1 is Spanish-only. The core rules, language policy, greeting, and both mode
// fragments are written for Spanish, so anything other than 'es' is rejected at
// this boundary rather than silently producing a mismatched prompt.
export const SUPPORTED_LANGUAGES = ['es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

interface BuildTutorPromptInput {
  mode: VoiceMode;
  targetLanguage: string;
  vocab: VocabItem[];
  speech: { slower: boolean };
}

interface BuildTutorPromptResult {
  prompt: string;
  firstMessage: string;
  promptVersion: string;
  sessionVocab: SessionVocabItem[];
}

function coreRules(): string {
  return [
    'You are a friendly, encouraging language tutor in a live spoken conversation.',
    'Keep turns short and natural. Never break character or mention that you are an AI.',
  ].join('\n');
}

// v1 is Spanish-only: the mode fragments are written in Spanish, so the language
// policy is too. `targetLanguage` is still threaded through (it is stored on the
// session and selects the mode) but only 'es' is supported today.
function languagePolicy(): string {
  return 'Speak in Spanish. Keep vocabulary and grammar appropriate for a learner; simplify if they struggle.';
}

export function buildTutorPrompt(input: BuildTutorPromptInput): BuildTutorPromptResult {
  if (!SUPPORTED_LANGUAGES.includes(input.targetLanguage as SupportedLanguage)) {
    throw new Error(
      `Unsupported target language: ${input.targetLanguage}. Only Spanish ('es') is supported in v1.`,
    );
  }

  const sessionVocab: SessionVocabItem[] = input.vocab.map((v) => ({
    ...v,
    bucket: bucketFor(v.familiarity),
  }));

  const mode = getModeDefinition(input.mode);
  const modeInstructions = mode.buildTutorInstructions({
    targetLanguage: input.targetLanguage,
    vocab: sessionVocab,
    speech: input.speech,
  });

  const prompt = [coreRules(), languagePolicy(), '', modeInstructions].join('\n');

  const firstMessage = '¡Hola! ¿Listo para practicar?';

  return { prompt, firstMessage, promptVersion: PROMPT_VERSION, sessionVocab };
}
