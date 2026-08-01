import { VoiceMode } from '../../db/models/conversationSession.model';

export type FamiliarityBucket = 'new' | 'learning' | 'known';

// The seam object VocabSource returns (NOT the Sequelize instance).
export interface VocabItem {
  id: string;
  sourceText: string; // English the learner typed
  term: string; // target-language phrase — the learning object
  itemType: 'word' | 'phrase';
  partOfSpeech?: string | null;
  familiarity: number; // 0-5
}

// A vocab item with its derived bucket, as snapshotted onto the session.
export interface SessionVocabItem extends VocabItem {
  bucket: FamiliarityBucket;
}

export interface ModeInstructionInput {
  targetLanguage: string;
  vocab: SessionVocabItem[];
  speech: { slower: boolean };
}

export interface ModeRubricInput {
  targetLanguage: string;
  vocab: SessionVocabItem[];
}

export interface VoiceModeDefinition {
  mode: VoiceMode;
  buildTutorInstructions(input: ModeInstructionInput): string;
  buildEvaluationRubric(input: ModeRubricInput): string;
  expectedObservationTypes: Array<'describe_to_name' | 'name_to_define' | 'contextual_use'>;
}
