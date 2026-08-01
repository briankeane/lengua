import { VoiceMode } from '../../../db/models/conversationSession.model';
import { bucketFor } from '../familiarity';
import { getModeDefinition } from '../modes';
import { SessionVocabItem, VocabItem } from '../types';

export const PROMPT_VERSION = 'voice-prompt-v1';

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

function languagePolicy(targetLanguage: string): string {
  if (targetLanguage === 'es') {
    return 'Speak in Spanish. Keep vocabulary and grammar appropriate for a learner; simplify if they struggle.';
  }
  return `Speak in the target language (${targetLanguage}). Simplify if the learner struggles.`;
}

export function buildTutorPrompt(input: BuildTutorPromptInput): BuildTutorPromptResult {
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

  const prompt = [coreRules(), languagePolicy(input.targetLanguage), '', modeInstructions].join(
    '\n',
  );

  const firstMessage =
    input.targetLanguage === 'es' ? '¡Hola! ¿Listo para practicar?' : 'Hi! Ready to practice?';

  return { prompt, firstMessage, promptVersion: PROMPT_VERSION, sessionVocab };
}
