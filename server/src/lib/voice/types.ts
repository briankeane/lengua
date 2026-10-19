import { VoiceMode } from '../../db/models/conversationSession.model';
import { ReviewTrack } from '../../db/models/vocabItem.model';

export type FamiliarityBucket = 'new' | 'learning' | 'known';

// The seam object the prompt builder consumes (NOT the Sequelize instance). PR4
// selects words via the SRS queue (getReviewQueue) and maps each ReviewCard into
// this shape; `familiarity` is the value of whichever track the mode exercises.
export interface VocabItem {
  id: string;
  sourceText: string; // English the learner typed
  targetText: string; // target-language phrase — the learning object
  familiarity: number; // 0-8, for the mode's review track (see VoiceModeDefinition.reviewDirection)
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
  // The SRS review track this mode exercises: quiz tests production
  // (meaning -> produce the word), weave tests reception (understand in context).
  // PR4 passes this as the `direction` to getReviewQueue when selecting words.
  reviewDirection: ReviewTrack;
  buildTutorInstructions(input: ModeInstructionInput): string;
  buildEvaluationRubric(input: ModeRubricInput): string;
  expectedObservationTypes: Array<'describe_to_name' | 'name_to_define' | 'contextual_use'>;
}
