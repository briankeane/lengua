import { VoiceMode } from '../../db/models/conversationSession.model';
import { ReviewTrack } from '../../db/models/vocabItem.model';

export type FamiliarityBucket = 'new' | 'learning' | 'known';

// The seam object the prompt builder consumes (NOT the Sequelize instance). PR4
// selects words via the SRS queue (getReviewQueue) and maps each ReviewCard into
// this shape; `familiarity` is the value of whichever track the mode exercises.
//
// Declared as a `type` (not `interface`) so it is structurally assignable to the
// session model's recursive `JsonValue`: PR4 snapshots `sessionVocab` onto
// `ConversationSession.vocabSnapshot`, and a TS interface lacks the implicit
// index signature that assignment requires.
export type VocabItem = {
  id: string;
  sourceText: string; // English the learner typed
  targetText: string; // target-language phrase — the learning object
  familiarity: number; // 0-8, for the mode's review track (see VoiceModeDefinition.reviewDirection)
};

// A vocab item with its derived bucket, as snapshotted onto the session.
export type SessionVocabItem = VocabItem & {
  bucket: FamiliarityBucket;
};

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
  // The SRS review track this mode exercises: quiz tests production
  // (meaning -> produce the word), weave tests reception (understand in context).
  // PR4 passes this as the `direction` to getReviewQueue when selecting words.
  reviewDirection: ReviewTrack;
  buildTutorInstructions(input: ModeInstructionInput): string;
  buildEvaluationRubric(input: ModeRubricInput): string;
  expectedObservationTypes: Array<'describe_to_name' | 'name_to_define' | 'contextual_use'>;
}
