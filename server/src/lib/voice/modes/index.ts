import { VoiceMode } from '../../../db/models/conversationSession.model';
import { VoiceModeDefinition } from '../types';
import { quizMode } from './quiz.mode';
import { weaveMode } from './weave.mode';

const REGISTRY: Record<string, VoiceModeDefinition> = {
  quiz: quizMode,
  weave: weaveMode,
};

export { quizMode, weaveMode };

export function getModeDefinition(mode: VoiceMode): VoiceModeDefinition {
  const def = REGISTRY[mode];
  if (!def) throw new Error(`Unknown voice mode: ${mode}`);
  return def;
}
